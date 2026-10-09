/* Big Cycle Monitor — analytics engine (pure functions, no DOM). */
(function (g) {
  const BCM = (g.BCM = g.BCM || {});
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const fmt = (x, d = 1) => (x == null || Number.isNaN(x) ? '—' : Number(x).toFixed(d));

  BCM.util = {
    clamp, fmt,
    pct: (x, d = 1) => (x == null || Number.isNaN(x) ? '—' : Number(x).toFixed(d) + '%'),
    usd: (bn) => (bn == null ? '—' : bn >= 1000 ? '$' + (bn / 1000).toFixed(1) + ' tn' : '$' + Math.round(bn) + ' bn')
  };

  /* ---- Debt-cycle phase ---------------------------------------------------------- */
  BCM.classifyPhase = function (c) {
    const debt = c.debtEff, infl = c.infl, bal = c.bal, cb = c.cb;
    const r = [];
    let phase, progress;
    if (infl >= 20) {
      if (bal >= -2 && debt < 100) {
        phase = 6; progress = clamp(1 - infl / 60);
        r.push(`Inflation ${fmt(infl)} % but the budget is near balance (${fmt(bal)} % of GDP) and debt is ${fmt(debt, 0)} % of GDP — a stabilisation / reset.`);
      } else {
        phase = 5; progress = clamp(infl / 60);
        r.push(`Inflation ${fmt(infl)} % with a ${fmt(bal)} % deficit — debt is being relieved through currency debasement.`);
      }
    } else if (infl >= 8) {
      phase = 5; progress = clamp(infl / 20);
      r.push(`Inflation ${fmt(infl)} % is far above target with deficit ${fmt(bal)} % of GDP — an inflationary, money-financed regime.`);
    } else if (debt >= 90 && cb >= 60) {
      phase = 5; progress = clamp(cb / 120);
      r.push(`Debt ${fmt(debt, 0)} % of GDP and central-bank assets ${fmt(cb, 0)} % of GDP — the central bank is a structural buyer of government debt.`);
    } else if (infl < 1.0 && debt >= 80) {
      phase = 4; progress = clamp((debt - 80) / 80 + 0.2);
      r.push(`Inflation only ${fmt(infl)} % with debt ${fmt(debt, 0)} % of GDP — a deflationary squeeze on debtors.`);
    } else if (debt >= 90) {
      phase = 3; progress = clamp(((debt - 90) / 60) * 0.5 + (Math.max(0, -bal) / 10) * 0.5);
      r.push(`Debt ${fmt(debt, 0)} % of GDP is above 90 %, deficit ${fmt(bal)} % of GDP — late-cycle debt load.`);
    } else if (debt >= 55 || bal <= -4.5) {
      phase = 2; progress = clamp(((debt - 55) / 35) * 0.6 + (Math.max(0, -bal - 2) / 6) * 0.4);
      r.push(`Debt ${fmt(debt, 0)} % of GDP and deficit ${fmt(bal)} % of GDP — debt is growing faster than the room to carry it.`);
    } else {
      phase = 1; progress = clamp((debt / 55) * 0.7 + (Math.max(0, -bal) / 5) * 0.3);
      r.push(`Debt ${fmt(debt, 0)} % of GDP and deficit ${fmt(bal)} % of GDP — comfortable capacity to borrow.`);
    }
    if (phase === 3 && progress > 0.7) r.push('Position is late within the top: any rate or growth shock would tip it toward squeeze or printing.');
    return { phase, progress, reasons: r };
  };

  /* ---- Power index (8 determinants) ------------------------------------------------ */
  BCM.determinants = function (c, maxGdp) {
    const output = 100 * Math.sqrt(c.gdp / maxGdp);
    const d = c.det; // edu, inno, comp, trade, mil, fin, res
    return [d[0], d[1], d[2], output, d[3], d[4], d[5], d[6]];
  };
  BCM.powerIndex = (vals) => vals.reduce((a, b) => a + b, 0) / vals.length;

  /* ---- Debt service helpers --------------------------------------------------------- */
  BCM.effRate = (c) => c.ieff != null ? c.ieff : 0.75 * c.y10;
  BCM.interestBill = (c) => (c.debtEff / 100) * BCM.effRate(c); // % of GDP

  /* ---- Risk model ------------------------------------------------------------------- */
  BCM.riskComponents = function (c) {
    const rf = 1 - 0.4 * (c.det[6] / 100);                        // reserve-currency discount
    const bill = BCM.interestBill(c);
    const rg = c.y10 - (c.growth + c.infl);
    return {
      __regime: clamp((c.infl - 15) / 30) * 12, // overlay: runaway-inflation regimes are crisis states in themselves
      debt: clamp((c.debtEff - 30) / 120) * 100 * rf,
      deficit: clamp(-c.bal / 9) * 100 * rf,
      service: (clamp(bill / 6) * 0.7 + clamp(rg / 6) * 0.3) * 100,
      macro: (clamp(Math.abs(c.infl - 2.5) / 10) * 0.65 + clamp((3 - c.growth) / 5) * 0.35) * 100,
      external: (clamp(-c.ca / 6) * 0.6 + clamp((c.infl - 5) / 30) * 0.4) * 100 * rf,
      monetise: (clamp(c.cb / 110) * 0.6 + clamp((c.infl - 4) / 16) * 0.4) * 100,
      internal: (c.ic / 10 * 0.55 + clamp((c.gini - 28) / 35) * 0.45) * 100,
      geo: clamp((c.ec / 10) * 0.7 + (c.trend < 0 ? 0.2 : c.trend > 0 ? -0.05 : 0)) * 100
    };
  };

  BCM.riskScore = function (comps, weights) {
    const keys = Object.keys(weights);
    const tot = keys.reduce((a, k) => a + weights[k], 0) || 1;
    const base = keys.reduce((a, k) => a + (comps[k] || 0) * weights[k], 0) / tot;
    return Math.min(100, base + (comps.__regime || 0));
  };

  BCM.band = (s) => BCM.BANDS.find((b) => s < b.max);

  /* ---- Debt dynamics projection ------------------------------------------------------ */
  /* d' = d (1+i) / ((1+g)(1+π)) − pb ; effective rate i drifts toward the market yield. */
  BCM.project = function (c, sc, years = 10) {
    sc = Object.assign({ dg: 0, di: 0, dr: 0, dpb: 0, repress: false }, sc);
    const y0 = c.year;
    const iEff0 = BCM.effRate(c);
    let d = c.debtEff, i = iEff0;
    const pb0 = c.bal + (d * iEff0) / 100;
    const LR = (c.growth + 1.8) / 2;
    const piT = c.infl > 10 ? Math.max(5, c.infl * 0.4) : 2.3;
    const dpb = sc.dpb > 0 ? sc.dpb * clamp((c.debtEff - 40) / 60) : sc.dpb; // austerity only bites where debt is high
    const out = [];
    for (let t = 0; t <= years; t++) {
      const gT = LR + (c.growth - LR) * Math.exp(-t / 3) + sc.dg * Math.min(t, 1);
      const piBase = piT + (c.infl - piT) * Math.exp(-t / 3);
      const pi = piBase + sc.di * Math.min(t / 2, 1);
      const ymkt = Math.max(0.2, c.y10 + sc.dr * Math.min(t / 2, 1) + 0.7 * (pi - c.infl));
      if (t > 0) i = sc.repress ? iEff0 + sc.dr * Math.min(t / 2, 1) : i + 0.14 * (ymkt - i);
      const pb = pb0 + dpb * Math.min(t / 5, 1);
      const bal = pb - (d * i) / 100;
      out.push({ year: y0 + t, debt: d, rate: i, g: gT, infl: pi, pb, bal, interest: (d * i) / 100, ymkt });
      const fx = c.fx || 0, piDebt = (1 - fx) * pi + fx * 2.3;   // FX-denominated debt is not inflated away
      d = (d * (1 + i / 100)) / ((1 + gT / 100) * (1 + piDebt / 100)) - pb;
      d = Math.max(0, d);
    }
    return out;
  };

  /* Re-classify the cycle phase at a future year of a projection. */
  BCM.phaseAt = function (c, path, t, sc) {
    const p = path[t];
    const cb = c.cb * (sc && sc.repress ? 1.25 : 1);
    return BCM.classifyPhase(Object.assign({}, c, { debtEff: p.debt, infl: p.infl, bal: p.bal, growth: p.g, cb }));
  };

  /* ---- Auto narrative --------------------------------------------------------------- */
  BCM.narrative = function (c) {
    const out = [];
    const ph = BCM.PHASES[c.phase.phase], st = BCM.STAGES[Math.floor(c.stage)];
    out.push(`<b>Debt cycle:</b> ${ph.name} (${Math.round(c.phase.progress * 100)} % through the phase). ${c.phase.reasons[0]}`);
    out.push(`<b>Big Cycle:</b> stage ${c.stage.toFixed(1)} — ${st.name}. ${st.blurb}`);
    const bill = BCM.interestBill(c);
    out.push(`<b>Debt service:</b> interest costs are roughly ${fmt(bill)} % of GDP (assumed average rate ${fmt(BCM.effRate(c))} %). The market yield is ${c.y10 > c.growth + c.infl ? 'above' : 'below'} nominal growth (${fmt(c.growth + c.infl)} %), so debt/GDP has a ${c.y10 > c.growth + c.infl ? 'snowball' : 'tailwind'} effect before the primary balance.`);
    const base = c.proj.base, stress = c.proj.stress;
    out.push(`<b>Trajectory:</b> base case moves debt from ${fmt(base[0].debt, 0)} % to ${fmt(base[10].debt, 0)} % of GDP by ${base[10].year}; a rate-and-recession shock takes it to ${fmt(stress[10].debt, 0)} %.`);
    if (c.det[6] > 50) out.push('<b>Reserve-currency privilege:</b> global demand for this currency lowers funding costs and extends each phase — but the discount erodes if debt supply outruns demand.');
    out.push(`<b>Analyst view:</b> ${c.note}`);
    out.push(`<b>Historical analog:</b> ${c.analog}`);
    return out;
  };

  /* ---- Alerts ------------------------------------------------------------------------ */
  BCM.alerts = function (list) {
    const A = [];
    list.forEach((c) => {
      const bill = BCM.interestBill(c);
      const b5 = c.proj.base[5], s5 = c.proj.stress[5];
      if (bill >= 3.5) A.push({ sev: Math.min(100, bill * 14), iso: c.iso, text: `${c.name}: interest bill ≈ ${fmt(bill)} % of GDP and rising toward ${fmt(b5.interest)} % by ${b5.year} in the base case.` });
      if (c.infl >= 10) A.push({ sev: Math.min(100, c.infl * 2), iso: c.iso, text: `${c.name}: inflation at ${fmt(c.infl)} % — currency debasement regime.` });
      if (c.debtEff >= 100 && c.bal <= -5) A.push({ sev: 55 + Math.min(40, -c.bal * 4), iso: c.iso, text: `${c.name}: debt ${fmt(c.debtEff, 0)} % of GDP with a ${fmt(-c.bal)} % deficit — debt/GDP keeps climbing at current policy.` });
      if (c.proj.base[10].debt - c.proj.base[0].debt >= 20) A.push({ sev: 60 + Math.min(30, c.proj.base[10].debt - c.proj.base[0].debt), iso: c.iso, text: `${c.name}: base case adds ${fmt(c.proj.base[10].debt - c.proj.base[0].debt, 0)} pts of GDP debt over ten years.` });
      if (c.phaseIn5.stress.phase !== c.phase.phase && c.phaseIn5.stress.phase >= 4 && c.phase.phase < 4) A.push({ sev: 65, iso: c.iso, text: `${c.name}: a rates-and-recession shock would push it from “${BCM.PHASES[c.phase.phase].short}” to “${BCM.PHASES[c.phaseIn5.stress.phase].short}” within five years.` });
      if (c.cb >= 60 && c.debtEff >= 90) A.push({ sev: 58, iso: c.iso, text: `${c.name}: central bank holds assets worth ${fmt(c.cb, 0)} % of GDP against ${fmt(c.debtEff, 0)} % public debt — exit from stimulus is the fragile point.` });
      if (c.gini >= 50) A.push({ sev: 52, iso: c.iso, text: `${c.name}: Gini ${fmt(c.gini, 0)} — the wealth gap amplifies internal-conflict risk.` });
    });
    return A.sort((a, b) => b.sev - a.sev);
  };

  /* ---- Record building ---------------------------------------------------------------- */
  /* Merge snapshot + live overrides + analyst overrides into evaluated country records. */
  BCM.build = function (settings, live) {
    const hiddenOn = settings.hidden !== false;
    const recs = BCM.COUNTRIES.map((base) => {
      const c = Object.assign({}, base);
      c.src = {};
      const L = (live && live.countries && live.countries[c.iso]) || {};
      c.year = (live && live.year) || 2025;
      ['gdp', 'growth', 'infl', 'debt', 'bal', 'ca', 'unemp', 'gini'].forEach((k) => {
        if (L[k] != null && !Number.isNaN(L[k])) { c[k] = L[k]; c.src[k] = L.__src && L.__src[k] || 'live'; } else c.src[k] = 'snapshot';
      });
      c.forecast = L.forecast || null;
      const ov = (settings.overrides && settings.overrides[c.iso]) || {};
      Object.keys(ov).forEach((k) => { if (ov[k] != null) { c[k] = ov[k]; c.src[k] = 'analyst'; } });
      c.debtEff = c.debt + (hiddenOn ? c.hidden : 0);
      return c;
    });
    const maxGdp = Math.max.apply(null, recs.map((r) => r.gdp));
    const totGdp = recs.reduce((a, r) => a + r.gdp, 0);
    recs.forEach((c) => {
      c.dets = BCM.determinants(c, maxGdp);
      c.power = BCM.powerIndex(c.dets);
      c.gdpShare = c.gdp / totGdp;
      c.phase = BCM.classifyPhase(c);
      /* data-implied Big Cycle stage: cross-check on the analyst's stage */
      c.stageImplied = 1 + 5 * clamp(1.45 * (0.38 * clamp((c.debtEff - 30) / 150) + 0.2 * clamp((c.gini - 28) / 35) + 0.22 * c.ic / 10 + 0.1 * c.ec / 10 + 0.1 * (1 - c.power / 100) - 0.15 * clamp(c.growth / 7)));
      c.comps = BCM.riskComponents(c);
      c.score = BCM.riskScore(c.comps, settings.weights);
      c.band = BCM.band(c.score);
      c.bill = BCM.interestBill(c);
      c.proj = {};
      Object.keys(BCM.SCENARIOS).forEach((k) => (c.proj[k] = BCM.project(c, BCM.SCENARIOS[k])));
      c.phaseIn5 = {
        base: BCM.phaseAt(c, c.proj.base, 5, BCM.SCENARIOS.base),
        stress: BCM.phaseAt(c, c.proj.stress, 5, BCM.SCENARIOS.stress),
        print: BCM.phaseAt(c, c.proj.print, 5, BCM.SCENARIOS.print)
      };
    });
    const byScore = recs.slice().sort((a, b) => b.score - a.score);
    byScore.forEach((c, i) => (c.riskRank = i + 1));
    recs.slice().sort((a, b) => b.power - a.power).forEach((c, i) => (c.powerRank = i + 1));
    recs.slice().sort((a, b) => b.gdp - a.gdp).forEach((c, i) => (c.gdpRank = i + 1));
    recs.forEach((c) => (c.narrative = BCM.narrative(c)));
    return recs;
  };
})(typeof window !== 'undefined' ? window : globalThis);
