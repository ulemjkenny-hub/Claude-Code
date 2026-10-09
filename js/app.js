/* Big Cycle Monitor — application: state, router and views. */
(function () {
  const { fmt, pct, usd, clamp } = BCM.util;
  const live = BCM.live;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ------------------------------------------------ persistent settings */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('bcm.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('bcm.' + k, JSON.stringify(v)); } catch (e) { /* storage may be unavailable */ } }
  };
  const defaultWeights = () => Object.fromEntries(BCM.RISK_FACTORS.map((f) => [f.key, f.w]));
  const app = (BCM.app = {
    settings: Object.assign({ weights: defaultWeights(), hidden: true, overrides: {}, theme: 'dark' }, store.get('settings', {})),
    recs: [], by: {}, metric: store.get('metric', 'risk'), sort: { k: 'score', dir: -1 }, sim: { iso: 'USA', dg: 0, di: 0, dr: 0, dpb: 0, repress: false, preset: 'base' },
    cmp: ['USA', 'CHN', 'JPN', 'DEU'], macroVersion: -1, route: null
  });
  app.settings.weights = Object.assign(defaultWeights(), app.settings.weights);
  const save = () => store.set('settings', app.settings);

  function recompute() {
    app.recs = BCM.build(app.settings, live);
    app.by = Object.fromEntries(app.recs.map((c) => [c.iso, c]));
    app.macroVersion = live.macroVersion;
  }

  /* ------------------------------------------------ small formatting helpers */
  const phaseChip = (p, withNum = true) => `<span class="chip" style="--c:${BCM.PHASES[p].color}">${withNum ? p + ' · ' : ''}${BCM.PHASES[p].name}</span>`;
  const stageChip = (s) => { const k = Math.min(6, Math.floor(s)); return `<span class="chip" style="--c:${BCM.STAGES[k].color}">${s.toFixed(1)} · ${BCM.STAGES[k].name}</span>`; };
  const bandChip = (b) => `<span class="chip" style="--c:${b.color}">${b.label}</span>`;
  const heat = (v) => d3.interpolateRgbBasis(['#2dd4a7', '#a3d94b', '#f5b83d', '#ff7a45', '#e5385a'])(clamp(v / 100));
  const srcTag = (c, k) => { const s = c.src[k]; const v = s === 'snapshot' ? 'snapshot' : s === 'analyst' ? 'override' : 'live'; return `<span class="src" title="${s}">${v}</span>`; };
  const dataMode = () => (live.countries && live.status.imf && live.status.imf.ok ? 'IMF WEO (live)' : live.countries ? 'World Bank (live)' : 'Embedded snapshot (approx. 2025)');
  const isLiveMacro = () => !!live.countries;
  const CCY = { DEU: 'EUR', FRA: 'EUR', ITA: 'EUR', ESP: 'EUR', NLD: 'EUR', JPN: 'JPY', GBR: 'GBP', CHE: 'CHF', CHN: 'CNY', IND: 'INR', BRA: 'BRL', TRY: 'TRY', TUR: 'TRY', CAN: 'CAD', KOR: 'KRW', MEX: 'MXN', AUS: 'AUD', ZAF: 'ZAR', POL: 'PLN', IDN: 'IDR' };

  /* ------------------------------------------------ map metrics */
  const RISK_RAMP = d3.interpolateRgbBasis(['#1f9e7a', '#a3d94b', '#f5b83d', '#ff7a45', '#e5385a']);
  const BLUE_RAMP = d3.interpolateRgbBasis(['#16324d', '#2b6aa8', '#5aa9ff', '#cfe8ff']);
  const GROWTH_RAMP = d3.interpolateRgbBasis(['#e5385a', '#f5b83d', '#a3d94b', '#2dd4a7']);
  const METRICS = {
    risk: { label: 'Composite risk', val: (r) => r.score, dom: [10, 55], ramp: RISK_RAMP, f: (v) => v.toFixed(0), unit: '/100' },
    phase: { label: 'Debt-cycle phase', cat: 'phase', val: (r) => r.phase.phase },
    stage: { label: 'Big Cycle stage', cat: 'stage', val: (r) => Math.min(6, Math.floor(r.stage)) },
    debt: { label: 'Debt / GDP', val: (r) => r.debtEff, dom: [30, 200], ramp: RISK_RAMP, f: (v) => v.toFixed(0), unit: '%' },
    deficit: { label: 'Deficit / GDP', val: (r) => -r.bal, dom: [0, 8], ramp: RISK_RAMP, f: (v) => v.toFixed(1), unit: '%' },
    bill: { label: 'Interest bill / GDP', val: (r) => r.bill, dom: [0.5, 6], ramp: RISK_RAMP, f: (v) => v.toFixed(1), unit: '%' },
    infl: { label: 'Inflation', val: (r) => r.infl, dom: [0, 12], ramp: RISK_RAMP, f: (v) => v.toFixed(1), unit: '%' },
    growth: { label: 'Real growth', val: (r) => r.growth, dom: [0, 6], ramp: GROWTH_RAMP, f: (v) => v.toFixed(1), unit: '%' },
    power: { label: 'Power index', val: (r) => r.power, dom: [20, 90], ramp: BLUE_RAMP, f: (v) => v.toFixed(0), unit: '/100' },
    gini: { label: 'Wealth gap (Gini)', val: (r) => r.gini, dom: [27, 60], ramp: RISK_RAMP, f: (v) => v.toFixed(0), unit: '' }
  };
  Object.keys(METRICS).forEach((k) => {
    const m = METRICS[k];
    if (m.cat === 'phase') m.color = (r) => BCM.PHASES[r.phase.phase].color;
    else if (m.cat === 'stage') m.color = (r) => BCM.STAGES[Math.min(6, Math.floor(r.stage))].color;
    else m.color = (r) => m.ramp(clamp((m.val(r) - m.dom[0]) / (m.dom[1] - m.dom[0])));
  });
  const legendHTML = (m) => {
    if (m.cat) {
      const set = m.cat === 'phase' ? BCM.PHASES : BCM.STAGES;
      return Object.keys(set).map((k) => `<span><i style="background:${set[k].color}"></i>${k} ${set[k].short || set[k].name}</span>`).join('');
    }
    const g = d3.range(0, 1.01, 0.1).map((t) => m.ramp(t)).join(',');
    return `<span>${m.dom[0]}${m.unit === '%' ? '%' : ''}</span><span class="ramp" style="background:linear-gradient(90deg,${g})"></span><span>${m.dom[1]}+${m.unit === '%' ? '%' : ''}</span>`;
  };
  const mapTip = (r) => `<b>${r.name}</b>
    <div class="tl"><span>Debt phase</span><b>${BCM.PHASES[r.phase.phase].name}</b></div>
    <div class="tl"><span>Big Cycle</span><b>${r.stage.toFixed(1)} · ${BCM.STAGES[Math.min(6, Math.floor(r.stage))].name}</b></div>
    <div class="tl"><span>Risk</span><b>${r.score.toFixed(0)} · ${r.band.label}</b></div>
    <div class="tl"><span>Debt / GDP</span><b>${fmt(r.debtEff, 0)}%</b></div>
    <div class="tl"><span>Deficit</span><b>${fmt(-r.bal)}%</b></div>
    <div class="tl"><span>Inflation</span><b>${fmt(r.infl)}%</b></div>
    <div class="tl"><span>Growth</span><b>${fmt(r.growth)}%</b></div>`;

  const go = (r) => { location.hash = '#/country/' + r.iso; };
  const cycleItems = (kind, hl) => app.recs.map((c) => kind === 'debt'
    ? { iso: c.iso, x: c.phase.phase - 1 + clamp(c.phase.progress, 0.08, 0.92), color: BCM.PHASES[c.phase.phase].color, hl: c.iso === hl, tip: `<b>${c.name}</b>${BCM.PHASES[c.phase.phase].name} · ${Math.round(c.phase.progress * 100)}% through<br>Debt ${fmt(c.debtEff, 0)}% GDP`, rec: c }
    : { iso: c.iso, x: c.stage - 1, color: BCM.STAGES[Math.min(6, Math.floor(c.stage))].color, hl: c.iso === hl, tip: `<b>${c.name}</b>Stage ${c.stage.toFixed(1)} · ${BCM.STAGES[Math.min(6, Math.floor(c.stage))].name}`, rec: c });

  /* ------------------------------------------------ ticker */
  const prevTick = {};
  function tick(label, val, delta, cls, wide) {
    return `<div class="tk${val == null ? ' na' : ''}${wide ? ' wide' : ''}"><b>${label}</b><span>${val == null ? 'unavailable' : val}</span>${delta != null ? `<em class="${cls}">${delta}</em>` : ''}</div>`;
  }
  function arrow(v, d = 2) { return v == null ? null : (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '') + Math.abs(v).toFixed(d) + '%'; }
  const cls = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
  function usDebtNow() {
    const m = live.market.usDebt;
    if (m) return { v: m.total + m.perSecond * Math.max(0, (Date.now() - (Date.parse(m.asOf) + 864e5)) / 1000), live: true, rate: m.perSecond, asOf: m.asOf };
    const rate = 2.1e12 / (365.25 * 86400);
    return { v: 38.0e12 + (rate * (Date.now() - Date.parse('2025-10-22T00:00:00Z'))) / 1000, live: false, rate, asOf: 'estimate' };
  }
  function renderTicker() {
    const M = live.market, d = usDebtNow();
    const out = [];
    out.push(`<div class="tk wide"><b>US national debt ${d.live ? '· live est.' : '· offline est.'}</b><span class="mono" id="usdebt">$${Math.round(d.v).toLocaleString('en-US')}</span><em class="down">+$${Math.round(d.rate).toLocaleString('en-US')}/s</em></div>`);
    const gp = M.gold && M.gold.price, gd = M.gold && M.gold.prev ? (gp / M.gold.prev - 1) * 100 : null;
    out.push(tick('Gold (XAU/USD)', gp ? '$' + gp.toLocaleString('en-US', { maximumFractionDigits: 0 }) : null, gd != null && gd !== 0 ? arrow(gd) : null, cls(gd)));
    const bp = M.btc && M.btc.price, bd = M.btc && M.btc.prev ? (bp / M.btc.prev - 1) * 100 : null;
    out.push(tick('Bitcoin', bp ? '$' + bp.toLocaleString('en-US', { maximumFractionDigits: 0 }) : null, bd != null && bd !== 0 ? arrow(bd) : null, cls(bd)));
    const u = M.ust || {};
    out.push(tick('US 10y yield', u.y10 ? u.y10.v.toFixed(2) + '%' : null, u.y10 && u.y2 ? `2s10s ${(u.y10.v - u.y2.v >= 0 ? '+' : '') + ((u.y10.v - u.y2.v) * 100).toFixed(0)}bp` : null, 'flat'));
    if (M.ustAvgRate) out.push(tick('Avg rate on US debt', M.ustAvgRate.rate.toFixed(2) + '%', null));
    [['EUR', 'EUR/USD', true], ['JPY', 'USD/JPY', false], ['CNY', 'USD/CNY', false], ['GBP', 'GBP/USD', true], ['CHF', 'USD/CHF', false]].forEach(([k, lab, inv]) => {
      const r = M.fx[k]; const ytd = M.fxYtd[k];
      out.push(tick(lab, r ? (inv ? (1 / r).toFixed(4) : r.toFixed(k === 'JPY' ? 2 : 4)) : null, ytd != null ? `${ytd >= 0 ? '▲' : '▼'} ${Math.abs(ytd).toFixed(1)}% YTD` : null, cls(ytd)));
    });
    out.push(`<div class="tk"><b>Refreshed</b><span style="font-size:13px">${new Date().toLocaleTimeString()}</span></div>`);
    $('#ticker').innerHTML = out.join('');
  }
  setInterval(() => { const e = $('#usdebt'); if (e) e.textContent = '$' + Math.round(usDebtNow().v).toLocaleString('en-US'); const k = $('#kpi-usdebt'); if (k) k.textContent = '$' + (usDebtNow().v / 1e12).toFixed(4) + ' tn'; }, 150);

  /* ------------------------------------------------ live pill / source panel */
  function updatePill() {
    const s = live.summary(), macro = isLiveMacro();
    const p = $('#livepill');
    p.className = 'pill ' + (macro ? 'live' : s.ok ? 'part' : 'off');
    $('#livetxt').textContent = !s.tried ? 'Connecting…' : (macro ? 'LIVE' : 'SNAPSHOT') + ` · ${s.ok}/${s.total} feeds`;
  }
  function sourcePanelHTML() {
    return `<h3 style="margin-bottom:8px">Data feeds</h3><table><thead><tr><th>Source</th><th>Status</th><th class="r">ms</th></tr></thead><tbody>` +
      BCM.SOURCES.map((s) => { const st = live.status[s.id]; return `<tr><td><b>${s.name}</b><div class="help">${s.what}</div></td><td>${!st ? '<span class="status-na">pending</span>' : st.ok ? `<span class="status-ok">● live</span><div class="help">${st.detail}</div>` : `<span class="status-bad">● unreachable</span><div class="help">${st.error || ''}</div>`}</td><td class="r mono">${st ? st.ms : ''}</td></tr>`; }).join('') +
      `</tbody></table><p class="help" style="margin:10px 0 0">Unreachable feeds fall back to the embedded snapshot. Browsers or networks may block some third-party hosts.</p><div style="margin-top:10px"><button class="btn primary" id="refreshAll">Refresh all now</button></div>`;
  }
  function togglePanel(e) {
    e.stopPropagation();
    let pop = $('.popover');
    if (pop) { pop.remove(); $('#livepill').setAttribute('aria-expanded', 'false'); return; }
    pop = document.createElement('div'); pop.className = 'popover'; pop.innerHTML = sourcePanelHTML(); document.body.appendChild(pop);
    $('#livepill').setAttribute('aria-expanded', 'true');
    $('#refreshAll', pop).onclick = () => { live.refreshAll(); };
  }
  document.addEventListener('click', (e) => { const pop = $('.popover'); if (pop && !pop.contains(e.target) && e.target.closest('#livepill') == null) { pop.remove(); $('#livepill').setAttribute('aria-expanded', 'false'); } });

  /* ================================================== VIEWS ================================================== */

  /* ---------- OVERVIEW ---------- */
  function viewOverview() {
    const R = app.recs, totGdp = d3.sum(R, (r) => r.gdp);
    const wDebt = d3.sum(R, (r) => r.debtEff * r.gdp) / totGdp, wBill = d3.sum(R, (r) => r.bill * r.gdp) / totGdp;
    const late = R.filter((r) => r.phase.phase >= 3 && r.phase.phase <= 5).length;
    const top = R.slice().sort((a, b) => b.score - a.score)[0];
    const lateGdp = d3.sum(R.filter((r) => r.phase.phase >= 3 && r.phase.phase <= 5), (r) => r.gdp) / totGdp;
    $('#view').innerHTML = `
      <div class="grid g-kpi">
        <div class="card kpi"><div class="l">Economies tracked</div><div class="v">${R.length}</div><div class="d">${usd(totGdp)} nominal GDP</div></div>
        <div class="card kpi"><div class="l">GDP-weighted debt</div><div class="v">${fmt(wDebt, 0)}%</div><div class="d">of GDP (gross govt.)</div></div>
        <div class="card kpi"><div class="l">Late-cycle economies</div><div class="v">${late}<span style="font-size:15px;color:var(--muted)"> / ${R.length}</span></div><div class="d">${Math.round(lateGdp * 100)}% of tracked GDP in phases 3–5</div></div>
        <div class="card kpi"><div class="l">Highest risk</div><div class="v">${top.name.split(' ').slice(-1)[0]}</div><div class="d">${top.score.toFixed(0)}/100 · ${top.band.label}</div></div>
        <div class="card kpi"><div class="l">Avg interest bill</div><div class="v">${fmt(wBill)}%</div><div class="d">of GDP (weighted, est.)</div></div>
        <div class="card kpi"><div class="l">US debt (live est.)</div><div class="v" id="kpi-usdebt" style="font-size:21px">…</div><div class="d">${live.market.usDebt ? 'Treasury "debt to the penny" + run-rate' : 'offline estimate'}</div></div>
      </div>
      <div class="grid g-main">
        <section class="card">
          <header><h2>World map · where each economy sits</h2>
            <div class="seg" id="metricSeg" role="group" aria-label="Map metric">${Object.keys(METRICS).map((k) => `<button data-m="${k}" class="${k === app.metric ? 'on' : ''}">${METRICS[k].label}</button>`).join('')}</div></header>
          <div class="mapwrap"><div id="map"></div><div class="mapctl"><button data-z="in" aria-label="Zoom in">+</button><button data-z="out" aria-label="Zoom out">−</button><button data-z="reset" aria-label="Reset zoom" style="font-size:12px">⟲</button></div></div>
          <div class="legend" id="legend"></div>
          <p class="help" style="margin:8px 0 0">Click a country for its full cycle diagnosis. Scroll or pinch to zoom. Data: ${dataMode()}.</p>
        </section>
        <section class="card">
          <header><h2>League table</h2><span class="help">click headers to sort</span></header>
          <div class="scroll" id="rank"></div>
        </section>
      </div>
      <div class="grid g-3" style="margin-top:14px">
        <section class="card"><header><h2>Phase mix (by GDP)</h2></header><div id="mix"></div></section>
        <section class="card"><header><h2>Watch-list · auto alerts</h2></header><div id="alerts"></div></section>
        <section class="card"><header><h2>10-year debt drift (base case)</h2></header><div id="drift"></div></section>
      </div>`;
    drawMap();
    $('#metricSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; app.metric = b.dataset.m; store.set('metric', app.metric); $$('#metricSeg button').forEach((x) => x.classList.toggle('on', x === b)); drawMap(); };
    drawRank();
    // phase mix
    const mix = Object.keys(BCM.PHASES).map((p) => ({ p, gdp: d3.sum(R.filter((r) => r.phase.phase == p), (r) => r.gdp), n: R.filter((r) => r.phase.phase == p).length }));
    $('#mix').innerHTML = `<div class="stack" role="img" aria-label="Share of GDP by debt phase">${mix.filter((m) => m.gdp > 0).map((m) => `<div style="flex:${m.gdp};background:${BCM.PHASES[m.p].color}" title="${BCM.PHASES[m.p].name}">${m.gdp / totGdp > 0.07 ? Math.round((m.gdp / totGdp) * 100) + '%' : ''}</div>`).join('')}</div>
      <table style="margin-top:12px"><tbody>${mix.map((m) => `<tr><td>${phaseChip(m.p)}</td><td class="r mono">${m.n}</td><td class="r mono">${Math.round((m.gdp / totGdp) * 100)}%</td><td class="help">${R.filter((r) => r.phase.phase == m.p).map((r) => r.iso).join(' ')}</td></tr>`).join('')}</tbody></table>`;
    // alerts
    $('#alerts').innerHTML = BCM.alerts(R).slice(0, 8).map((a) => `<div class="alert" data-iso="${a.iso}"><i style="background:${heat(a.sev)}"></i><div>${a.text}</div></div>`).join('') || '<p class="help">No alerts.</p>';
    $$('#alerts .alert').forEach((el) => (el.onclick = () => (location.hash = '#/country/' + el.dataset.iso)));
    // drift
    const dr = R.map((r) => ({ r, d: r.proj.base[10].debt - r.proj.base[0].debt })).sort((a, b) => b.d - a.d).slice(0, 10);
    const mx = d3.max(dr, (x) => Math.abs(x.d));
    $('#drift').innerHTML = dr.map((x) => `<div class="factor" style="grid-template-columns:96px 1fr 62px;cursor:pointer" data-iso="${x.r.iso}"><span>${x.r.name.length > 13 ? x.r.iso : x.r.name}</span><div class="bar"><i style="width:${(Math.abs(x.d) / mx) * 100}%;background:${x.d > 0 ? 'var(--bad)' : 'var(--good)'}"></i></div><b class="num" style="text-align:right">${x.d > 0 ? '+' : ''}${x.d.toFixed(0)} pts</b></div>`).join('');
    $$('#drift [data-iso]').forEach((el) => (el.onclick = () => (location.hash = '#/country/' + el.dataset.iso)));
  }
  function drawMap() {
    const m = METRICS[app.metric];
    BCM.charts.map('#map', app.recs, m, { tip: mapTip, onClick: go });
    $('#legend').innerHTML = `<b style="color:var(--fg)">${m.label}</b>` + legendHTML(m);
  }
  function drawRank() {
    const { k, dir } = app.sort;
    const keyf = { name: (r) => r.name, phase: (r) => r.phase.phase + r.phase.progress, stage: (r) => r.stage, score: (r) => r.score, debt: (r) => r.debtEff, gdp: (r) => r.gdp }[k];
    const rows = app.recs.slice().sort((a, b) => (keyf(a) > keyf(b) ? 1 : -1) * dir);
    const th = (key, label, cls2 = '') => `<th class="s ${cls2}" data-k="${key}">${label}${k === key ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    $('#rank').innerHTML = `<table><thead class="sticky-h"><tr>${th('name', 'Country')}${th('phase', 'Debt phase')}${th('stage', 'Stage', 'r')}${th('debt', 'Debt', 'r')}${th('score', 'Risk')}</tr></thead><tbody>` +
      rows.map((r) => `<tr class="link" data-iso="${r.iso}"><td><b>${r.name}</b></td><td>${phaseChip(r.phase.phase, false)}</td><td class="r mono">${r.stage.toFixed(1)}</td><td class="r mono">${fmt(r.debtEff, 0)}%</td><td style="min-width:110px"><div style="display:flex;align-items:center;gap:7px"><div class="bar" style="flex:1"><i style="width:${clamp(r.score / 60) * 100}%;background:${heat(r.score * 1.6)}"></i></div><b class="num" style="width:24px;text-align:right">${r.score.toFixed(0)}</b></div></td></tr>`).join('') + '</tbody></table>';
    $$('#rank th.s').forEach((h) => (h.onclick = () => { const kk = h.dataset.k; app.sort = { k: kk, dir: app.sort.k === kk ? -app.sort.dir : (kk === 'name' ? 1 : -1) }; drawRank(); }));
    $$('#rank tr.link').forEach((tr) => (tr.onclick = () => (location.hash = '#/country/' + tr.dataset.iso)));
  }

  /* ---------- COUNTRY ---------- */
  function viewCountry(iso) {
    const c = app.by[iso];
    if (!c) { $('#view').innerHTML = '<div class="card">Unknown country. <a href="#/overview">Back to overview</a></div>'; return; }
    const ph = BCM.PHASES[c.phase.phase], stg = BCM.STAGES[Math.min(6, Math.floor(c.stage))];
    const ccy = CCY[iso], fxr = ccy && live.market.fx[ccy], ytd = ccy && live.market.fxYtd[ccy];
    const base = c.proj.base, comp = c.comps;
    const f = c.forecast;
    $('#view').innerHTML = `
      <div class="hero">
        <div><a href="#/overview" class="help">← Overview</a><h1>${c.name} <span class="help" style="font-size:16px">${c.iso}</span></h1>
          <div class="meta"><span>GDP ${usd(c.gdp)} (#${c.gdpRank})</span><span>Power index ${c.power.toFixed(0)}/100 (#${c.powerRank})</span><span>Risk rank #${c.riskRank} of ${app.recs.length}</span><span>Data: ${c.year} · ${dataMode()}</span></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${phaseChip(c.phase.phase)} ${stageChip(c.stage)} ${bandChip(c.band)}</div>
      </div>
      <div class="grid g-4">
        <section class="card"><header><h2>Debt-cycle phase</h2></header>
          <div class="big" style="color:${ph.color}">${c.phase.phase}. ${ph.name}</div>
          <div class="progress" style="margin:8px 0"><i style="width:${c.phase.progress * 100}%;background:${ph.color}"></i></div>
          <div class="help">${Math.round(c.phase.progress * 100)}% through this phase</div><p style="margin:8px 0 0">${ph.blurb}</p></section>
        <section class="card"><header><h2>Big Cycle stage</h2></header>
          <div class="big" style="color:${stg.color}">${c.stage.toFixed(1)} · ${stg.name}</div>
          <div class="progress" style="margin:8px 0"><i style="width:${((c.stage - 1) / 6) * 100}%;background:${stg.color}"></i></div>
          <div class="help">Data-implied cross-check: ${c.stageImplied.toFixed(1)}</div><p style="margin:8px 0 0">${stg.blurb}</p></section>
        <section class="card"><header><h2>Composite risk</h2></header>
          <div id="gauge"></div><div style="text-align:center;margin-top:-4px"><span class="big">${c.score.toFixed(0)}</span><span class="help"> / 100 </span>${bandChip(c.band)}</div></section>
        <section class="card"><header><h2>Key numbers</h2></header>
          <div class="fact"><span>Debt / GDP</span><b>${fmt(c.debtEff, 0)}%${c.hidden && app.settings.hidden ? ` <span class="src">incl. +${c.hidden} hidden</span>` : srcTag(c, 'debt')}</b></div>
          <div class="fact"><span>Deficit / GDP</span><b>${fmt(-c.bal)}%${srcTag(c, 'bal')}</b></div>
          <div class="fact"><span>Interest bill (est.)</span><b>${fmt(c.bill)}% GDP</b></div>
          <div class="fact"><span>Real growth</span><b>${fmt(c.growth)}%${srcTag(c, 'growth')}</b></div>
          <div class="fact"><span>Inflation</span><b>${fmt(c.infl)}%${srcTag(c, 'infl')}</b></div>
          <div class="fact"><span>Current account</span><b>${fmt(c.ca)}%${srcTag(c, 'ca')}</b></div>
          <div class="fact"><span>Unemployment</span><b>${fmt(c.unemp)}%${srcTag(c, 'unemp')}</b></div>
          <div class="fact"><span>Wealth gap (Gini)</span><b>${fmt(c.gini, 0)}${srcTag(c, 'gini')}</b></div>
          <div class="fact"><span>10y yield · CB assets</span><b>${fmt(c.y10)}% · ${fmt(c.cb, 0)}%</b></div>
          ${ccy ? `<div class="fact"><span>${ccy} vs USD (live)</span><b>${fxr ? fxr.toFixed(ccy === 'JPY' || ccy === 'KRW' || ccy === 'IDR' ? 2 : 4) : 'n/a'}${ytd != null ? ` <em class="${cls(ytd)}" style="font-style:normal">${ytd >= 0 ? '▲' : '▼'}${Math.abs(ytd).toFixed(1)}% YTD</em>` : ''}</b></div>` : ''}
        </section>
      </div>
      <div class="grid g-2" style="margin-top:14px">
        <section class="card"><header><h2>Long-term debt cycle</h2><span class="help">${c.name} highlighted</span></header><div id="cyc1"></div></section>
        <section class="card"><header><h2>Big Cycle (internal order) arc</h2><span class="help">${c.name} highlighted</span></header><div id="cyc2"></div></section>
      </div>
      <div class="grid g-2" style="margin-top:14px">
        <section class="card"><header><h2>Eight determinants of power</h2><span class="help">vs ${c.iso === 'USA' ? 'China' : 'United States'}</span></header><div id="radar"></div></section>
        <section class="card"><header><h2>Risk decomposition</h2><a href="#/matrix" class="help">edit weights →</a></header><div class="factors" id="factors"></div></section>
      </div>
      <div class="grid g-2" style="margin-top:14px">
        <section class="card"><header><h2>Debt / GDP — scenarios to ${base[10].year}</h2></header><div id="pdebt"></div><div class="help">Debt-dynamics model: d′ = d·(1+i)/((1+g)(1+π)) − primary balance. Hover for values.</div></section>
        <section class="card"><header><h2>Interest bill — % of GDP</h2></header><div id="pint"></div></section>
      </div>
      <div class="grid g-3" style="margin-top:14px">
        <section class="card"><header><h2>${f ? 'IMF outlook · real growth' : 'Model outlook · real growth'}</h2></header><div id="fg"></div></section>
        <section class="card"><header><h2>${f ? 'IMF outlook · inflation' : 'Model outlook · inflation'}</h2></header><div id="fi"></div></section>
        <section class="card"><header><h2>Predicted phase path</h2></header>
          <table><thead><tr><th>Scenario</th><th>Phase in 5 yrs</th><th class="r">Debt ${base[5].year}</th></tr></thead><tbody>
          <tr><td>Today</td><td>${phaseChip(c.phase.phase, false)}</td><td class="r mono">${fmt(base[0].debt, 0)}%</td></tr>
          ${['base', 'stress', 'print', 'consolidate'].map((k) => { const sc = BCM.SCENARIOS[k]; const pp = k === 'consolidate' ? BCM.phaseAt(c, c.proj[k], 5, sc) : c.phaseIn5[k]; return `<tr><td>${sc.name}</td><td>${phaseChip(pp.phase, false)}</td><td class="r mono">${fmt(c.proj[k][5].debt, 0)}%</td></tr>`; }).join('')}
          </tbody></table><p class="help" style="margin:8px 0 0">Re-classifies the cycle phase using each scenario’s projected debt, inflation, deficit and growth.</p></section>
      </div>
      <div class="grid g-2" style="margin-top:14px">
        <section class="card"><header><h2>Through Dalio’s lens</h2></header><ul class="list">${c.narrative.map((n) => `<li>${n}</li>`).join('')}</ul></section>
        <section class="card"><header><h2>Analyst overrides · what-if</h2><button class="btn" id="resetOv">Reset ${c.iso}</button></header>
          <p class="help" style="margin-top:-4px">Change the judgement inputs or macro data and the whole dashboard recomputes. Saved in your browser only.</p>
          <div id="ovr"></div></section>
      </div>`;
    BCM.charts.gauge('#gauge', c.score);
    const dim = true;
    BCM.charts.cycle('#cyc1', cycleItems('debt', iso), { kind: 'debt', dim, onClick: (n) => go(n.rec), height: 300 });
    BCM.charts.cycle('#cyc2', cycleItems('stage', iso), { kind: 'stage', dim, onClick: (n) => go(n.rec), height: 300 });
    const rival = app.by[iso === 'USA' ? 'CHN' : 'USA'];
    BCM.charts.radar('#radar', BCM.DETERMINANTS, [{ name: c.name, color: '#5aa9ff', vals: c.dets }, { name: rival.name, color: '#8b9cb2', vals: rival.dets }]);
    $('#factors').innerHTML = BCM.RISK_FACTORS.map((fct) => `<div class="factor" title="${fct.hint}"><span>${fct.label}</span><div class="bar"><i style="width:${comp[fct.key]}%;background:${heat(comp[fct.key])}"></i></div><b class="num">${comp[fct.key].toFixed(0)}</b></div>`).join('') +
      (comp.__regime > 0.5 ? `<p class="help">+${comp.__regime.toFixed(1)} pts regime overlay for runaway inflation.</p>` : '') + '<p class="help">Hover a row for what it measures. Higher = worse.</p>';
    const sc = ['base', 'stress', 'consolidate', 'print', 'boom'];
    BCM.charts.line('#pdebt', sc.map((k) => ({ name: BCM.SCENARIOS[k].name.split(' ')[0] === 'Beautiful' ? 'Deleverage' : BCM.SCENARIOS[k].name.split(' ')[0], color: BCM.SCENARIOS[k].color, dash: k === 'base' ? null : '5 4', width: k === 'base' ? 3 : 2, pts: c.proj[k].map((p) => [p.year, p.debt]) })), { height: 270, yFmt: (v) => v + '%', tipFmt: (v) => v.toFixed(0) + '% GDP', endLabels: true, refLines: [{ y: 100, label: '100% of GDP' }], label: 'Debt to GDP scenarios' });
    BCM.charts.line('#pint', sc.map((k) => ({ name: BCM.SCENARIOS[k].name.split(' ')[0] === 'Beautiful' ? 'Deleverage' : BCM.SCENARIOS[k].name.split(' ')[0], color: BCM.SCENARIOS[k].color, dash: k === 'base' ? null : '5 4', width: k === 'base' ? 3 : 2, pts: c.proj[k].map((p) => [p.year, p.interest]) })), { height: 270, yFmt: (v) => v.toFixed(1) + '%', tipFmt: (v) => v.toFixed(2) + '% GDP', endLabels: true, zero: true, label: 'Interest bill' });
    const nowY = c.year;
    const fser = (key, modelKey) => {
      if (f && f[key]) { const pts = Object.keys(f[key]).map(Number).filter((y) => y >= nowY - 3 && y <= nowY + 5).sort().map((y) => [y, f[key][y]]); if (pts.length > 2) return { pts, name: 'IMF', color: '#5aa9ff' }; }
      return { pts: base.slice(0, 6).map((p) => [p.year, p[modelKey]]), name: 'Model', color: '#a58bff' };
    };
    const sg = fser('growth', 'g'), si = fser('infl', 'infl');
    BCM.charts.line('#fg', [sg], { height: 200, minSpan: 2, yFmt: (v) => v.toFixed(1) + '%', tipFmt: (v) => v.toFixed(1) + '%', xMark: nowY, label: 'growth outlook' });
    BCM.charts.line('#fi', [si], { height: 200, minSpan: 2, yFmt: (v) => v.toFixed(1) + '%', tipFmt: (v) => v.toFixed(1) + '%', xMark: nowY, label: 'inflation outlook' });
    buildOverrides(c);
  }

  function buildOverrides(c) {
    const ov = (app.settings.overrides[c.iso] = app.settings.overrides[c.iso] || {});
    const rows = [
      ['ic', 'Internal conflict (0–10)', 0, 10, 0.5], ['ec', 'External conflict (0–10)', 0, 10, 0.5], ['stage', 'Big Cycle stage (1–6.9)', 1, 6.9, 0.1],
      ['debt', 'Gov. debt % GDP', 0, 300, 1], ['bal', 'Net lending % GDP', -15, 5, 0.1], ['infl', 'Inflation %', -2, 60, 0.1], ['growth', 'Real growth %', -6, 10, 0.1], ['y10', '10y yield %', 0, 40, 0.1]
    ];
    $('#ovr').innerHTML = rows.map(([k, lab, mn, mx, st]) => `<label class="slider"><span>${lab}</span><input type="range" min="${mn}" max="${mx}" step="${st}" value="${c[k]}" data-k="${k}" aria-label="${lab}"><output>${Number(c[k]).toFixed(st < 1 ? 1 : 0)}</output></label>`).join('') +
      `<label class="slider"><span>Power trend</span><select class="in" data-k="trend"><option value="-1">Declining</option><option value="0">Stable</option><option value="1">Rising</option></select><span></span></label>`;
    $('#ovr select').value = String(c.trend);
    $$('#ovr input').forEach((i) => { i.oninput = () => (i.nextElementSibling.textContent = Number(i.value).toFixed(i.step < 1 ? 1 : 0)); i.onchange = () => { ov[i.dataset.k] = +i.value; save(); recompute(); render(true); }; });
    $('#ovr select').onchange = (e) => { ov.trend = +e.target.value; save(); recompute(); render(true); };
    $('#resetOv').onclick = () => { delete app.settings.overrides[c.iso]; save(); recompute(); render(true); };
    $('#resetOv').disabled = !Object.keys(ov).length;
  }

  /* ---------- CYCLE LAB ---------- */
  function viewCycle() {
    const sim = app.sim;
    $('#view').innerHTML = `
      <div class="hero"><div><h1>Cycle Lab</h1><div class="meta"><span>Where every economy sits on the two Big Cycles — then stress-test the debt.</span></div></div></div>
      <div class="grid g-2">
        <section class="card"><header><h2>1 · Long-term debt cycle (six phases)</h2></header>
          <div id="c1"></div><p class="help">Position inside each phase is computed from debt/GDP, deficit, inflation and central-bank balance sheet (see Method). Click a bubble to open a country.</p></section>
        <section class="card"><header><h2>2 · Big Cycle: rise &amp; decline (six stages)</h2></header>
          <div id="c2"></div><p class="help">Stage is an analyst judgement of internal order (wealth gap, polarisation) and power position; a data-implied cross-check is on each country page.</p></section>
      </div>
      <section class="card" style="margin-top:14px"><header><h2>Debt simulator · four levers</h2>
        <div style="display:flex;gap:8px;align-items:center"><span class="help">Country</span><select class="in" id="simC" style="width:auto">${app.recs.map((r) => `<option value="${r.iso}">${r.name}</option>`).join('')}</select></div></header>
        <div class="seg" id="presets" style="margin-bottom:10px">${Object.keys(BCM.SCENARIOS).map((k) => `<button data-k="${k}">${BCM.SCENARIOS[k].name}</button>`).join('')}<button data-k="custom">Custom</button></div>
        <div class="grid g-2">
          <div id="simCtl"></div>
          <div><div id="simChart"></div></div>
        </div>
        <div id="simKpi" style="margin-top:10px"></div>
      </section>
      <div class="grid g-4" style="margin-top:14px">
        ${[['Austerity', 'Spend less, tax more. Lowers debt but is deflationary — raises unemployment and can widen conflict.', 'Primary balance ↑'], ['Default / restructure', 'Debt is written down. Cleans the balance sheet; creditors lose, credibility is damaged.', 'Debt ↓ at once'], ['Redistribute wealth', 'Shift resources from the haves to the have-nots through taxes. Politically explosive late in the cycle.', 'Internal conflict ↑'], ['Print money', 'Central bank buys debt; currency and bonds are debased. Inflationary and a hidden tax on savers.', 'Inflation ↑, real debt ↓']].map(([t, d, m]) => `<section class="card"><h3>${t}</h3><p>${d}</p><span class="tag">${m}</span></section>`).join('')}
      </div>`;
    BCM.charts.cycle('#c1', cycleItems('debt'), { kind: 'debt', onClick: (n) => go(n.rec), height: 360 });
    BCM.charts.cycle('#c2', cycleItems('stage'), { kind: 'stage', onClick: (n) => go(n.rec), height: 360 });
    $('#simC').value = sim.iso;
    $('#simC').onchange = (e) => { sim.iso = e.target.value; drawSim(); };
    $('#presets').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k; sim.preset = k; if (k !== 'custom') { const s = BCM.SCENARIOS[k]; Object.assign(sim, { dg: s.dg, di: s.di, dr: s.dr, dpb: s.dpb, repress: s.repress }); } drawSim(); };
    drawSim();
  }
  function drawSim() {
    const sim = app.sim, c = app.by[sim.iso];
    $$('#presets button').forEach((b) => b.classList.toggle('on', b.dataset.k === sim.preset));
    const sl = [['dg', 'Real growth Δ (pts)', -3, 3, 0.1], ['di', 'Inflation Δ (pts)', -3, 8, 0.1], ['dr', 'Market yield Δ (pts)', -3, 5, 0.1], ['dpb', 'Primary balance Δ (pts GDP)', -4, 6, 0.1]];
    if (!$('#simCtl').dataset.built || $('#simCtl').dataset.iso !== sim.iso) {
      $('#simCtl').dataset.built = 1; $('#simCtl').dataset.iso = sim.iso;
      $('#simCtl').innerHTML = sl.map(([k, l, mn, mx, st]) => `<label class="slider"><span>${l}</span><input type="range" min="${mn}" max="${mx}" step="${st}" data-k="${k}" aria-label="${l}"><output></output></label>`).join('') +
        `<label class="slider"><span>Financial repression</span><input type="checkbox" id="rep" aria-label="Financial repression"><span class="help" style="grid-column:2/4">Central bank caps borrowing costs while inflation runs hot.</span></label>
         <p class="help">Start: debt ${fmt(c.debtEff, 0)}% GDP · avg rate ${fmt(BCM.effRate(c))}% · deficit ${fmt(-c.bal)}% · growth ${fmt(c.growth)}% · inflation ${fmt(c.infl)}%.</p>`;
      $$('#simCtl input[type=range]').forEach((i) => (i.oninput = () => { sim[i.dataset.k] = +i.value; sim.preset = 'custom'; drawSim(); }));
      $('#rep').onchange = (e) => { sim.repress = e.target.checked; sim.preset = 'custom'; drawSim(); };
    }
    $$('#simCtl input[type=range]').forEach((i) => { i.value = sim[i.dataset.k]; i.nextElementSibling.textContent = (sim[i.dataset.k] > 0 ? '+' : '') + Number(sim[i.dataset.k]).toFixed(1); });
    $('#rep').checked = sim.repress;
    const mine = BCM.project(c, sim);
    const series = [{ name: 'Your scenario', color: '#5aa9ff', width: 3.4, pts: mine.map((p) => [p.year, p.debt]) },
      { name: 'Base', color: '#8b9cb2', dash: '5 4', width: 1.8, pts: c.proj.base.map((p) => [p.year, p.debt]) }];
    BCM.charts.line('#simChart', series, { height: 270, yFmt: (v) => v + '%', tipFmt: (v) => v.toFixed(0) + '% GDP', endLabels: true, refLines: [{ y: 100, label: '100% of GDP' }], label: 'Simulated debt path' });
    const last = mine[10], p5 = BCM.phaseAt(c, mine, 5, sim);
    $('#simKpi').innerHTML = `<table><thead><tr><th>Metric</th><th class="r">${mine[0].year}</th><th class="r">${mine[5].year}</th><th class="r">${last.year}</th></tr></thead><tbody>
      <tr><td>Debt / GDP</td><td class="r mono">${fmt(mine[0].debt, 0)}%</td><td class="r mono">${fmt(mine[5].debt, 0)}%</td><td class="r mono">${fmt(last.debt, 0)}%</td></tr>
      <tr><td>Interest bill / GDP</td><td class="r mono">${fmt(mine[0].interest)}%</td><td class="r mono">${fmt(mine[5].interest)}%</td><td class="r mono">${fmt(last.interest)}%</td></tr>
      <tr><td>Overall balance / GDP</td><td class="r mono">${fmt(mine[0].bal)}%</td><td class="r mono">${fmt(mine[5].bal)}%</td><td class="r mono">${fmt(last.bal)}%</td></tr>
      <tr><td>Inflation · nominal rate</td><td class="r mono">${fmt(mine[0].infl)}% · ${fmt(mine[0].rate)}%</td><td class="r mono">${fmt(mine[5].infl)}% · ${fmt(mine[5].rate)}%</td><td class="r mono">${fmt(last.infl)}% · ${fmt(last.rate)}%</td></tr>
      <tr><td>Cycle phase</td><td class="r">${phaseChip(c.phase.phase, false)}</td><td class="r">${phaseChip(p5.phase, false)}</td><td class="r"></td></tr></tbody></table>`;
  }

  /* ---------- RISK & FORECAST ---------- */
  function viewMatrix() {
    const W = app.settings.weights;
    $('#view').innerHTML = `
      <div class="hero"><div><h1>Risk matrix &amp; forecasts</h1><div class="meta"><span>Eight risk factors, your weights, and what the debt maths implies.</span></div></div></div>
      <div class="grid" style="grid-template-columns:minmax(0,3fr) minmax(260px,1fr)">
        <section class="card"><header><h2>Heat-map · higher is worse</h2><span class="help">click a column to sort</span></header><div class="scroll" id="heat" style="max-height:none"></div></section>
        <section class="card"><header><h2>Factor weights</h2><button class="btn" id="resetW">Reset</button></header>
          ${BCM.RISK_FACTORS.map((f) => `<label class="slider" style="grid-template-columns:1fr 70px 30px" title="${f.hint}"><span>${f.label}</span><input type="range" min="0" max="30" step="1" value="${W[f.key]}" data-k="${f.key}" aria-label="${f.label} weight"><output>${W[f.key]}</output></label>`).join('')}
          <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="hid" ${app.settings.hidden ? 'checked' : ''}> Include off-balance-sheet debt (e.g. China LGFV)</label>
          <p class="help">Weights are normalised to 100. Score bands: Low &lt; 28 · Moderate &lt; 38 · Elevated &lt; 48 · High &lt; 58 · Critical.</p></section>
      </div>
      <section class="card" style="margin-top:14px"><header><h2>Forecast table · debt, interest and cycle phase</h2></header><div class="scroll" id="fc" style="max-height:none"></div>
        <p class="help" style="margin:8px 0 0">Base case: current policy, borrowing costs reprice to market over ~8 years. Stress: yields +2 pts, growth −1.5 pts, deficit +1 pt. Print &amp; repress: inflation +4 pts with capped rates. Indicative scenario maths — not a forecast of outcomes.</p></section>`;
    drawHeat(); drawFc();
    $$('input[type=range]').forEach((i) => { i.oninput = () => { i.nextElementSibling.textContent = i.value; W[i.dataset.k] = +i.value; }; i.onchange = () => { save(); recompute(); drawHeat(); drawFc(); }; });
    $('#hid').onchange = (e) => { app.settings.hidden = e.target.checked; save(); recompute(); drawHeat(); drawFc(); };
    $('#resetW').onclick = () => { app.settings.weights = defaultWeights(); save(); recompute(); viewMatrix(); };
  }
  let heatSort = { k: 'score', dir: -1 };
  function drawHeat() {
    const cols = BCM.RISK_FACTORS;
    const rows = app.recs.slice().sort((a, b) => ((heatSort.k === 'score' ? a.score : a.comps[heatSort.k]) - (heatSort.k === 'score' ? b.score : b.comps[heatSort.k])) * heatSort.dir);
    $('#heat').innerHTML = `<table class="heat"><thead><tr><th>Country</th>${cols.map((f) => `<th class="s r" data-k="${f.key}" title="${f.hint}">${f.label}${heatSort.k === f.key ? (heatSort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}<th class="s r" data-k="score">Total${heatSort.k === 'score' ? (heatSort.dir > 0 ? ' ▲' : ' ▼') : ''}</th></tr></thead><tbody>` +
      rows.map((r) => `<tr class="link" data-iso="${r.iso}"><td><b>${r.name}</b></td>${cols.map((f) => `<td class="c" style="background:${heat(r.comps[f.key])}">${r.comps[f.key].toFixed(0)}</td>`).join('')}<td class="c" style="background:${heat(r.score * 1.6)}">${r.score.toFixed(0)}</td></tr>`).join('') + '</tbody></table>';
    $$('#heat th.s').forEach((h) => (h.onclick = () => { heatSort = { k: h.dataset.k, dir: heatSort.k === h.dataset.k ? -heatSort.dir : -1 }; drawHeat(); }));
    $$('#heat tr.link').forEach((tr) => (tr.onclick = () => (location.hash = '#/country/' + tr.dataset.iso)));
  }
  function drawFc() {
    const rows = app.recs.slice().sort((a, b) => b.proj.stress[10].debt - a.proj.stress[10].debt);
    $('#fc').innerHTML = `<table><thead><tr><th>Country</th><th>Phase now</th><th class="r">Debt now</th><th class="r">+5y base</th><th class="r">+10y base</th><th class="r">+10y stress</th><th class="r">+10y print</th><th class="r">Interest now → +5y</th><th>Phase +5y base / stress</th></tr></thead><tbody>` +
      rows.map((r) => `<tr class="link" data-iso="${r.iso}"><td><b>${r.name}</b></td><td>${phaseChip(r.phase.phase, false)}</td><td class="r mono">${fmt(r.proj.base[0].debt, 0)}%</td><td class="r mono">${fmt(r.proj.base[5].debt, 0)}%</td><td class="r mono">${fmt(r.proj.base[10].debt, 0)}%</td><td class="r mono down">${fmt(r.proj.stress[10].debt, 0)}%</td><td class="r mono">${fmt(r.proj.print[10].debt, 0)}%</td><td class="r mono">${fmt(r.proj.base[0].interest)}% → ${fmt(r.proj.base[5].interest)}%</td><td>${phaseChip(r.phaseIn5.base.phase, false)} ${phaseChip(r.phaseIn5.stress.phase, false)}</td></tr>`).join('') + '</tbody></table>';
    $$('#fc tr.link').forEach((tr) => (tr.onclick = () => (location.hash = '#/country/' + tr.dataset.iso)));
  }

  /* ---------- COMPARE ---------- */
  const PAL = ['#5aa9ff', '#f5b83d', '#2dd4a7', '#ff7a45'];
  function viewCompare(q) {
    if (q && q.c) app.cmp = q.c.split(',').filter((i) => app.by[i]).slice(0, 4);
    if (!app.cmp.length) app.cmp = ['USA', 'CHN'];
    const sel = app.cmp.map((i) => app.by[i]);
    $('#view').innerHTML = `
      <div class="hero"><div><h1>Compare economies</h1><div class="meta"><span>Choose up to four.</span></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${sel.map((c, i) => `<span class="chip" style="--c:${PAL[i]}">${c.name} <a href="#" data-rm="${c.iso}" aria-label="Remove ${c.name}" style="color:inherit">✕</a></span>`).join('')}
        ${sel.length < 4 ? `<select class="in" id="addC" style="width:auto"><option value="">+ add country</option>${app.recs.filter((r) => !app.cmp.includes(r.iso)).map((r) => `<option value="${r.iso}">${r.name}</option>`).join('')}</select>` : ''}</div></div>
      <div class="grid g-2">
        <section class="card"><header><h2>Eight determinants of power</h2></header><div id="cr"></div></section>
        <section class="card"><header><h2>Debt / GDP — base case</h2></header><div id="cd"></div></section>
      </div>
      <section class="card" style="margin-top:14px"><header><h2>Side by side</h2></header><div class="scroll" style="max-height:none"><table><thead><tr><th>Metric</th>${sel.map((c, i) => `<th class="r" style="color:${PAL[i]}">${c.iso}</th>`).join('')}</tr></thead><tbody>` +
      [['Debt phase', (c) => phaseChip(c.phase.phase, false)], ['Big Cycle stage', (c) => c.stage.toFixed(1)], ['Composite risk', (c) => `${c.score.toFixed(0)} · ${c.band.label}`], ['GDP', (c) => usd(c.gdp)], ['Power index', (c) => c.power.toFixed(0)], ['Debt / GDP', (c) => fmt(c.debtEff, 0) + '%'], ['Deficit / GDP', (c) => fmt(-c.bal) + '%'], ['Interest bill', (c) => fmt(c.bill) + '% GDP'], ['Inflation', (c) => fmt(c.infl) + '%'], ['Real growth', (c) => fmt(c.growth) + '%'], ['Current account', (c) => fmt(c.ca) + '%'], ['Gini', (c) => fmt(c.gini, 0)], ['Debt +10y (base)', (c) => fmt(c.proj.base[10].debt, 0) + '%'], ['Debt +10y (stress)', (c) => fmt(c.proj.stress[10].debt, 0) + '%']]
        .map(([l, fn]) => `<tr><td>${l}</td>${sel.map((c) => `<td class="r mono">${fn(c)}</td>`).join('')}</tr>`).join('') + `</tbody></table></div></section>
      <section class="card" style="margin-top:14px"><header><h2>Risk decomposition</h2></header><div class="grid g-2">${BCM.RISK_FACTORS.map((f) => `<div><div class="help" style="margin-bottom:3px">${f.label}</div>${sel.map((c, i) => `<div class="factor" style="grid-template-columns:44px 1fr 34px"><span style="color:${PAL[i]}">${c.iso}</span><div class="bar"><i style="width:${c.comps[f.key]}%;background:${PAL[i]}"></i></div><b class="num">${c.comps[f.key].toFixed(0)}</b></div>`).join('')}</div>`).join('')}</div></section>`;
    BCM.charts.radar('#cr', BCM.DETERMINANTS, sel.map((c, i) => ({ name: c.name, color: PAL[i], vals: c.dets })));
    BCM.charts.line('#cd', sel.map((c, i) => ({ name: c.iso, color: PAL[i], pts: c.proj.base.map((p) => [p.year, p.debt]) })), { height: 300, yFmt: (v) => v + '%', tipFmt: (v) => v.toFixed(0) + '%', endLabels: true });
    const upd = () => { location.hash = '#/compare?c=' + app.cmp.join(','); };
    $$('[data-rm]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); app.cmp = app.cmp.filter((i) => i !== a.dataset.rm); upd(); }));
    const add = $('#addC'); if (add) add.onchange = () => { if (add.value) { app.cmp.push(add.value); upd(); } };
  }

  /* ---------- BOOK EXPLORER ---------- */
  function viewBook() {
    const notes = store.get('notes', {});
    const done = BCM.CONCEPTS.filter((c) => notes[c.id] && notes[c.id].read).length;
    const parts = [...new Set(BCM.CONCEPTS.map((c) => c.part))];
    $('#view').innerHTML = `
      <div class="hero"><div><h1>Book Explorer</h1><div class="meta"><span>Ray Dalio’s big-cycle frameworks → how this dashboard measures each one.</span></div></div>
        <div style="min-width:240px"><div class="help">Reading progress · ${done}/${BCM.CONCEPTS.length}</div><div class="progress" style="margin-top:4px"><i style="width:${(done / BCM.CONCEPTS.length) * 100}%"></i></div></div></div>
      <div class="callout info">This explorer is built from Dalio’s publicly described frameworks, paraphrased in my own words. It has <b>not</b> ingested the text of any specific book, so there are no page-by-page quotations. Use the <b>page</b> and <b>notes</b> fields to log where each idea appears in your own copy — they’re saved in your browser. To map an actual PDF or pasted text page by page, share it and the concept cards can be regenerated with real page references.</div>
      ${parts.map((p) => `<h2 class="part">${p}</h2><div class="grid g-2">${BCM.CONCEPTS.filter((c) => c.part === p).map((c) => { const n = notes[c.id] || {}; return `
        <section class="card concept ${n.read ? 'read' : ''}" data-id="${c.id}">
          <header><h3>${c.title}</h3><label class="help" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-f="read" ${n.read ? 'checked' : ''}> read</label></header>
          <p>${c.body}</p>
          <div class="meas"><b>On the dashboard:</b> ${c.measure}</div>
          <div class="tags" style="margin:10px 0">${c.watch.map((w) => `<span class="tag">${w}</span>`).join('')}</div>
          <div style="display:grid;grid-template-columns:90px 1fr;gap:8px;align-items:start"><input class="in" data-f="page" placeholder="page(s)" value="${(n.page || '').replace(/"/g, '&quot;')}" aria-label="Page reference"><textarea class="in" data-f="text" placeholder="Your notes…" aria-label="Notes">${(n.text || '').replace(/</g, '&lt;')}</textarea></div>
        </section>`; }).join('')}</div>`).join('')}`;
    $$('.concept').forEach((card) => {
      const id = card.dataset.id;
      $$('[data-f]', card).forEach((inp) => { inp.onchange = inp.oninput = () => { const all = store.get('notes', {}); all[id] = all[id] || {}; all[id][inp.dataset.f] = inp.type === 'checkbox' ? inp.checked : inp.value; store.set('notes', all); if (inp.type === 'checkbox') viewBook(); }; });
    });
  }

  /* ---------- METHOD ---------- */
  function viewMethod() {
    $('#view').innerHTML = `
      <div class="hero"><div><h1>Method &amp; sources</h1><div class="meta"><span>How every number is produced, and what is live versus estimated.</span></div></div><button class="btn primary" id="rf">Refresh all feeds</button></div>
      <div class="grid g-2">
        <section class="card"><header><h2>Live feed health</h2></header><div id="health"></div></section>
        <section class="card"><header><h2>What is real, what is judgement</h2></header><ul class="list">
          <li><b>Data (live when reachable):</b> growth, inflation, debt, deficit, current account, unemployment, GDP — IMF WEO (with forecasts to ${new Date().getFullYear() + 5}); Gini — World Bank; US debt — Treasury; FX, gold, BTC and US yields from public APIs.</li>
          <li><b>Snapshot (approximate):</b> the same fields as embedded 2025-scale fallbacks, 10-year yields for non-US economies and central-bank balance sheets (these are not fetched live).</li>
          <li><b>Analyst judgement (editable):</b> the six internal-order stage, internal/external conflict scores, power determinants other than output, power trend, off-balance-sheet debt adjustments.</li>
          <li><b>Model outputs:</b> debt-cycle phase, risk scores, projections, alerts, “implied” stage.</li></ul></section>
      </div>
      <div class="grid g-2" style="margin-top:14px">
        <section class="card"><header><h2>Debt-cycle phase rules</h2></header>
          <table><tbody>
          <tr><td>${phaseChip(6)}</td><td>Inflation ≥ 20 % with a balanced budget (≥ −2 % GDP) and debt &lt; 100 %.</td></tr>
          <tr><td>${phaseChip(5)}</td><td>Inflation ≥ 20 % otherwise; or inflation ≥ 8 %; or debt ≥ 90 % with central-bank assets ≥ 60 % of GDP.</td></tr>
          <tr><td>${phaseChip(4)}</td><td>Inflation &lt; 1 % with debt ≥ 80 % of GDP.</td></tr>
          <tr><td>${phaseChip(3)}</td><td>Debt ≥ 90 % of GDP.</td></tr>
          <tr><td>${phaseChip(2)}</td><td>Debt ≥ 55 % of GDP or deficit ≥ 4.5 % of GDP.</td></tr>
          <tr><td>${phaseChip(1)}</td><td>Otherwise.</td></tr></tbody></table>
          <p class="help">Rules are applied top-down. Position within a phase is a 0–100 % score from the distance to the next threshold. These are transparent heuristics inspired by Dalio’s debt-crisis template, not his own numbers.</p></section>
        <section class="card"><header><h2>Risk model</h2></header>
          <table><tbody>${BCM.RISK_FACTORS.map((f) => `<tr><td><b>${f.label}</b></td><td>${f.hint}</td><td class="r mono">${f.w}</td></tr>`).join('')}</tbody></table>
          <p class="help">Each factor is scaled 0–100 and combined with the (editable) weights. Reserve-currency issuers get up to a 40 % discount on debt, deficit and external factors. Inflation ≥ 15 % adds a regime overlay of up to 12 pts. Interest bill = debt × 0.75 × 10y yield unless a country-specific average cost is set.</p></section>
      </div>
      <section class="card" style="margin-top:14px"><header><h2>Projection engine</h2></header>
        <p>Each year: <span class="mono">d′ = d·(1+i) / ((1+g)(1+π)) − pb</span>. Growth fades toward a long-run rate, inflation toward ~2.3 % (or half of current if above 10 %), the average interest rate <i>i</i> moves 14 % of the way to the market yield each year (≈ 8-year refinancing), and market yield follows inflation at 0.7×. Foreign-currency debt is not inflated away. Scenario switches add shifts to growth, inflation, yields and the primary balance; <i>Print &amp; repress</i> pins the average rate.</p>
        <p class="help">Limits: government debt only (no private-sector debt), no default dynamics, a single deflator, no feedback from rates to growth. Treat outputs as scenario illustrations.</p></section>`;
    $('#health').innerHTML = sourcePanelHTML();
    $('#refreshAll').onclick = $('#rf').onclick = () => { live.refreshAll(); };
  }

  /* ================================================== ROUTER ================================================== */
  function parse() {
    const h = location.hash.replace(/^#\/?/, '') || 'overview';
    const [path, qs] = h.split('?'); const q = {}; (qs || '').split('&').forEach((p) => { const [k, v] = p.split('='); if (k) q[k] = decodeURIComponent(v || ''); });
    const [name, arg] = path.split('/');
    return { name, arg, q };
  }
  function render(keepScroll) {
    const r = parse(); const key = r.name + '/' + (r.arg || '');
    const y = window.scrollY;
    $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === r.name || (r.name === 'country' && a.dataset.r === 'overview')));
    $('#jump').value = r.name === 'country' ? r.arg : '';
    const fn = { overview: viewOverview, country: () => viewCountry(r.arg), cycle: viewCycle, matrix: viewMatrix, compare: () => viewCompare(r.q), book: viewBook, method: viewMethod }[r.name] || viewOverview;
    document.title = r.name === 'country' && app.by[r.arg] ? app.by[r.arg].name + ' · Big Cycle Monitor' : 'Big Cycle Monitor';
    fn();
    if (keepScroll === true && app.route === key) window.scrollTo(0, y); else window.scrollTo(0, 0);
    app.route = key;
  }
  window.addEventListener('hashchange', () => render());
  let rzT, lastW = innerWidth;
  window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (Math.abs(innerWidth - lastW) > 30) { lastW = innerWidth; render(true); } }, 250); });

  /* ================================================== BOOT ================================================== */
  function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); app.settings.theme = t; save(); if (app.recs.length) render(true); }
  function boot() {
    document.documentElement.setAttribute('data-theme', app.settings.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
    recompute();
    $('#jump').innerHTML = '<option value="">Jump to country…</option>' + app.recs.slice().sort((a, b) => a.name.localeCompare(b.name)).map((r) => `<option value="${r.iso}">${r.name}</option>`).join('');
    $('#jump').onchange = (e) => { if (e.target.value) location.hash = '#/country/' + e.target.value; };
    $('#theme').onclick = () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    $('#livepill').onclick = togglePanel;
    live.onChange(() => {
      updatePill(); renderTicker();
      if (live.macroVersion !== app.macroVersion) { recompute(); render(true); }
      const h = $('#health'); if (h) { h.innerHTML = sourcePanelHTML(); const b = $('#refreshAll'); if (b) b.onclick = () => live.refreshAll(); }
      const pop = $('.popover'); if (pop) { pop.innerHTML = sourcePanelHTML(); $('#refreshAll', pop).onclick = () => live.refreshAll(); }
    });
    renderTicker(); updatePill(); render();
    live.refreshAll();
    setInterval(() => live.refreshFast(), 60000);
    setInterval(() => live.loadMacro(), 30 * 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
