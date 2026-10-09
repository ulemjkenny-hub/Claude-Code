/* Big Cycle Monitor — live data layer.
 * Every source is optional: failures are recorded in BCM.live.status and the app falls back to the
 * embedded snapshot, so the dashboard always renders. Nothing is faked: each panel says what it is. */
(function (g) {
  const BCM = (g.BCM = g.BCM || {});
  const ISO = () => BCM.COUNTRIES.map((c) => c.iso);

  const live = (BCM.live = {
    status: {},          // id -> {ok, at, ms, error, detail}
    year: null,          // data year for IMF/WB fields
    countries: null,     // iso -> {gdp, growth, ..., forecast:{ind:{year:v}}, __src}
    market: {            // fast-moving series
      btc: null, gold: null, fx: {}, fxYtd: {}, usDebt: null, ust: {}, ustAvgRate: null
    },
    macroVersion: 0,
    listeners: []
  });
  live.onChange = (fn) => live.listeners.push(fn);
  const emit = () => live.listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

  async function getJSON(url, ms = 9000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  async function getText(url, ms = 9000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } finally { clearTimeout(t); }
  }
  function mark(id, ok, t0, detail, error) {
    live.status[id] = { ok, at: Date.now(), ms: Date.now() - t0, detail: detail || '', error: error ? String(error.message || error) : '' };
  }
  const cacheGet = (k, ttl) => { try { const o = JSON.parse(localStorage.getItem('bcm.cache.' + k)); if (o && Date.now() - o.t < ttl) return o.v; } catch (e) { /* storage unavailable */ } return null; };
  const cacheSet = (k, v) => { try { localStorage.setItem('bcm.cache.' + k, JSON.stringify({ t: Date.now(), v })); } catch (e) { /* ignore */ } };

  /* ------------------------------------------------ macro (IMF → World Bank) */
  const IMF_MAP = {
    NGDPD: 'gdp_bn', NGDP_RPCH: 'growth', PCPIPCH: 'infl', GGXWDG_NGDP: 'debt',
    GGXCNL_NGDP: 'bal', BCA_NGDPD: 'ca', LUR: 'unemp'
  };

  async function loadIMF() {
    const t0 = Date.now();
    const keys = Object.keys(IMF_MAP);
    const res = await Promise.all(keys.map((k) => getJSON('https://www.imf.org/external/datamapper/api/v1/' + k, 12000).then((j) => [k, j.values && j.values[k]])));
    const data = {};
    res.forEach(([k, v]) => { if (v) data[k] = v; });
    if (!data.NGDP_RPCH && !data.GGXWDG_NGDP) throw new Error('empty response');
    const nowY = new Date().getFullYear();
    const out = {};
    ISO().forEach((iso) => {
      const rec = (out[iso] = { forecast: {}, __src: {} });
      keys.forEach((k) => {
        const ser = data[k] && data[k][iso];
        if (!ser) return;
        const f = IMF_MAP[k];
        // use the current year (IMF carries projections), else latest available before it
        let y = nowY;
        while (y > nowY - 6 && ser[y] == null) y--;
        if (ser[y] == null) return;
        const val = f === 'gdp_bn' ? ser[y] : ser[y];
        if (f === 'gdp_bn') { rec.gdp = val; rec.__src.gdp = 'IMF ' + y; } else { rec[f] = val; rec.__src[f] = 'IMF ' + y; }
        rec.forecast[f === 'gdp_bn' ? 'gdp' : f] = ser;
        rec.__year = Math.max(rec.__year || 0, y);
      });
    });
    live.year = nowY;
    mark('imf', true, t0, `${keys.length} indicators · ${Object.keys(out).length} economies · up to ${nowY + 5}`);
    return out;
  }

  const WB_IND = { growth: 'NY.GDP.MKTP.KD.ZG', infl: 'FP.CPI.TOTL.ZG', debt: 'GC.DOD.TOTL.GD.ZS', gdp: 'NY.GDP.MKTP.CD', unemp: 'SL.UEM.TOTL.ZS', ca: 'BN.CAB.XOKA.GD.ZS' };
  async function wbOne(ind, mrnev) {
    const list = ISO().join(';');
    const j = await getJSON(`https://api.worldbank.org/v2/country/${list}/indicator/${ind}?format=json&per_page=500&mrnev=${mrnev || 1}`, 12000);
    if (!Array.isArray(j) || !Array.isArray(j[1])) throw new Error('unexpected WB payload');
    const m = {};
    j[1].forEach((r) => { if (r.value != null) m[r.countryiso3code] = { v: r.value, y: +r.date }; });
    return m;
  }

  async function loadWBGini() {
    const t0 = Date.now();
    const m = await wbOne('SI.POV.GINI');
    const out = {};
    Object.keys(m).forEach((iso) => { out[iso] = { gini: m[iso].v, __gy: m[iso].y }; });
    mark('wb', true, t0, `Gini for ${Object.keys(m).length} economies`);
    return out;
  }

  async function loadWBMacro() {
    const t0 = Date.now();
    const keys = Object.keys(WB_IND);
    const res = await Promise.all(keys.map((k) => wbOne(WB_IND[k]).then((m) => [k, m]).catch(() => [k, {}])));
    const out = {};
    res.forEach(([k, m]) => Object.keys(m).forEach((iso) => {
      const rec = (out[iso] = out[iso] || { __src: {} });
      rec[k] = k === 'gdp' ? m[iso].v / 1e9 : m[iso].v;
      rec.__src[k] = 'World Bank ' + m[iso].y;
    }));
    if (!Object.keys(out).length) throw new Error('no data');
    mark('wb', true, t0, `fallback macro for ${Object.keys(out).length} economies`);
    return out;
  }

  live.loadMacro = async function () {
    const cached = cacheGet('macro', 6 * 3600 * 1000);
    let macro = null;
    try { macro = cached || (await loadIMF()); if (!cached) cacheSet('macro', macro); else mark('imf', true, Date.now(), 'from 6h local cache'); }
    catch (e) {
      mark('imf', false, Date.now(), '', e);
      try { macro = await loadWBMacro(); live.year = new Date().getFullYear() - 1; } catch (e2) { mark('wb', false, Date.now(), '', e2); }
    }
    let gini = null;
    try { gini = cacheGet('gini', 24 * 3600 * 1000) || (await loadWBGini()); cacheSet('gini', gini); if (!live.status.wb || !live.status.wb.ok) mark('wb', true, Date.now(), 'Gini (cached)'); } catch (e) { if (!live.status.wb || !live.status.wb.ok) mark('wb', false, Date.now(), '', e); }
    if (macro || gini) {
      live.countries = live.countries || {};
      ISO().forEach((iso) => {
        const m = (macro && macro[iso]) || {}, gi = (gini && gini[iso]) || {};
        const rec = Object.assign({}, m);
        rec.__src = Object.assign({}, m.__src || {});
        if (gi.gini != null) { rec.gini = gi.gini; rec.__src.gini = 'World Bank ' + gi.__gy; }
        live.countries[iso] = rec;
      });
      if (!live.year) live.year = new Date().getFullYear();
      live.macroVersion++;
    }
    emit();
  };

  /* ------------------------------------------------ fast market data */
  live.loadUSDebt = async function () {
    const t0 = Date.now();
    try {
      const u = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page%5Bsize%5D=40&fields=record_date,tot_pub_debt_out_amt,debt_held_public_amt,intragov_hold_amt';
      const j = await getJSON(u);
      const rows = (j.data || []).map((r) => ({ d: r.record_date, v: parseFloat(r.tot_pub_debt_out_amt), pub: parseFloat(r.debt_held_public_amt) })).filter((r) => r.v > 0);
      if (rows.length < 2) throw new Error('no rows');
      const a = rows[0], b = rows[rows.length - 1];
      const days = (new Date(a.d) - new Date(b.d)) / 86400000 || 1;
      live.market.usDebt = { total: a.v, asOf: a.d, perSecond: (a.v - b.v) / days / 86400, pub: a.pub, history: rows.slice().reverse() };
      mark('ust', true, t0, `as of ${a.d}`);
    } catch (e) { mark('ust', false, t0, '', e); }
    try {
      const u = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?sort=-record_date&page%5Bsize%5D=1&filter=security_desc:eq:Total%20Interest-bearing%20Debt';
      const j = await getJSON(u);
      const r = j.data && j.data[0];
      if (r) live.market.ustAvgRate = { rate: parseFloat(r.avg_interest_rate_amt), asOf: r.record_date };
    } catch (e) { /* optional */ }
    emit();
  };

  const FX_SET = ['EUR', 'JPY', 'GBP', 'CHF', 'CNY', 'INR', 'BRL', 'TRY', 'CAD', 'KRW', 'MXN', 'AUD', 'ZAR', 'PLN', 'IDR'];
  live.loadFX = async function () {
    const t0 = Date.now();
    try {
      const sym = FX_SET.join(',');
      const yr = new Date().getFullYear();
      let latest, start;
      try {
        latest = await getJSON(`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${sym}`);
        start = await getJSON(`https://api.frankfurter.dev/v1/${yr}-01-02?base=USD&symbols=${sym}`);
      } catch (e) {
        latest = await getJSON(`https://api.frankfurter.app/latest?from=USD&to=${sym}`);
        start = await getJSON(`https://api.frankfurter.app/${yr}-01-02?from=USD&to=${sym}`);
      }
      live.market.fx = latest.rates || {};
      live.market.fxDate = latest.date;
      live.market.fxYtd = {};
      Object.keys(live.market.fx).forEach((k) => {
        const a = live.market.fx[k], b = start.rates && start.rates[k];
        if (a && b) live.market.fxYtd[k] = (b / a - 1) * 100; // USD value of the foreign currency, YTD %
      });
      mark('fx', true, t0, `ECB reference rates · ${latest.date}`);
    } catch (e) {
      try {
        const j = await getJSON('https://open.er-api.com/v6/latest/USD');
        if (j.result !== 'success') throw new Error('bad payload');
        live.market.fx = {}; FX_SET.forEach((k) => { if (j.rates[k]) live.market.fx[k] = j.rates[k]; });
        live.market.fxDate = (j.time_last_update_utc || '').slice(5, 16);
        live.market.fxYtd = {};
        mark('fx', true, t0, 'ER-API (no YTD history)');
      } catch (e2) { mark('fx', false, t0, '', e2); }
    }
    emit();
  };

  live.loadCrypto = async function () {
    const t0 = Date.now();
    try {
      const j = await getJSON('https://api.coinbase.com/v2/prices/BTC-USD/spot', 7000);
      const prev = live.market.btc && live.market.btc.price;
      live.market.btc = { price: parseFloat(j.data.amount), prev, at: Date.now() };
      mark('btc', true, t0, 'spot');
    } catch (e) { mark('btc', false, t0, '', e); }
    emit();
  };

  live.loadGold = async function () {
    const t0 = Date.now();
    try {
      const j = await getJSON('https://api.gold-api.com/price/XAU', 7000);
      if (!(j.price > 0)) throw new Error('bad payload');
      const prev = live.market.gold && live.market.gold.price;
      live.market.gold = { price: j.price, prev, at: Date.now() };
      mark('gold', true, t0, 'XAU/USD');
    } catch (e) { mark('gold', false, t0, '', e); }
    emit();
  };

  live.loadYields = async function () {
    const t0 = Date.now();
    try {
      const one = async (id) => {
        const txt = await getText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10)}`, 9000);
        const rows = txt.trim().split('\n').slice(1).map((l) => l.split(',')).filter((r) => r[1] && r[1] !== '.' && !isNaN(+r[1]));
        return rows.map((r) => ({ d: r[0], v: +r[1] }));
      };
      const [t10, t2] = await Promise.all([one('DGS10'), one('DGS2')]);
      if (!t10.length) throw new Error('empty');
      live.market.ust = { y10: t10[t10.length - 1], y2: t2[t2.length - 1], h10: t10, h2: t2 };
      mark('fred', true, t0, `as of ${t10[t10.length - 1].d}`);
    } catch (e) { mark('fred', false, t0, '', e); }
    emit();
  };

  live.refreshFast = () => Promise.allSettled([live.loadCrypto(), live.loadGold(), live.loadFX(), live.loadUSDebt(), live.loadYields()]);
  live.refreshAll = () => Promise.allSettled([live.loadMacro(), live.refreshFast()]);
  live.summary = function () {
    const ids = BCM.SOURCES.map((s) => s.id);
    const ok = ids.filter((i) => live.status[i] && live.status[i].ok).length;
    const tried = ids.filter((i) => live.status[i]).length;
    return { ok, tried, total: ids.length };
  };
})(window);
