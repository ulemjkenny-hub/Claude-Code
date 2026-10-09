/* Big Cycle Monitor — embedded data.
 *
 * SNAPSHOT fields (gdp … cb) are approximate 2025 figures in the range published by
 * the IMF WEO / World Bank / central banks. They are only a fallback: when the live
 * feeds in live.js succeed, they overwrite these values and the UI says so.
 *
 * EDITORIAL fields (det, trend, ic, ec, stage, hidden, note, analog) are analyst
 * judgements built on Ray Dalio's published frameworks. They are NOT official data;
 * the UI lets the user override them.
 */
(function (g) {
  const BCM = (g.BCM = g.BCM || {});

  /* gdp: USD bn · growth/infl: % · debt: gross general govt % GDP · bal: net lending % GDP
     ca: current account % GDP · unemp: % · gini: index · y10: 10y govt yield % · cb: central-bank assets % GDP
     det: [education, innovation, competitiveness, trade, military, financial centre, reserve currency] 0-100
     trend: power trajectory −1 declining · 0 flat · +1 rising
     ic/ec: internal / external conflict intensity 0-10 · stage: Big Cycle stage 1.0-6.99
     hidden: off-balance-sheet debt adjustment, pts of GDP · fx: share of public debt in foreign currency (0-1; inflation does not erode it) · ieff: optional average effective interest rate on debt (%) */
  BCM.COUNTRIES = [
    { iso: 'USA', num: 840, name: 'United States', gdp: 30300, growth: 1.9, infl: 2.7, debt: 122, bal: -7.3, ca: -4.0, unemp: 4.2, gini: 41.3, y10: 4.2, cb: 22,
      det: [80, 95, 85, 70, 100, 100, 100], trend: -1, ic: 8, ec: 6, stage: 5.0, hidden: 0,
      analog: '1930s–40s: record debt, wealth gap, polarisation and a rising rival, resolved by heavy monetisation.',
      note: 'Reserve-currency privilege still funds deficits cheaply, but interest costs now rival defence and politics is the binding constraint on fiscal repair.' },
    { iso: 'CHN', num: 156, name: 'China', gdp: 19400, growth: 4.8, infl: 0.0, debt: 96, bal: -7.4, ca: 2.2, unemp: 5.1, gini: 35.7, y10: 1.7, cb: 30,
      det: [70, 85, 75, 100, 80, 45, 12], trend: 1, ic: 3, ec: 7, stage: 3.7, hidden: 25,
      analog: 'Japan after 1990: property bust, deflation pressure, local-government debt.',
      note: 'Rising power facing a deflationary debt squeeze: property deleveraging, local-government (LGFV) debt and weak demand offset a strong export engine.' },
    { iso: 'DEU', num: 276, name: 'Germany', gdp: 4700, growth: 0.2, infl: 2.2, debt: 63, bal: -2.7, ca: 5.0, unemp: 3.5, gini: 31.7, y10: 2.7, cb: 38,
      det: [82, 78, 80, 80, 40, 55, 15], trend: -1, ic: 4, ec: 4, stage: 3.9, hidden: 0,
      analog: 'Late-1970s UK: strong savings and industry, but losing competitiveness and energy advantage.',
      note: 'Low debt gives room, and the debt brake is being loosened for defence and infrastructure — but the industrial model is under structural pressure.' },
    { iso: 'JPN', num: 392, name: 'Japan', gdp: 4200, growth: 1.1, infl: 3.0, debt: 235, bal: -3.0, ca: 4.0, unemp: 2.5, gini: 32.9, y10: 1.6, cb: 100,
      det: [85, 82, 75, 65, 45, 60, 12], trend: -1, ic: 3, ec: 5, stage: 4.3, hidden: 0,
      analog: 'Itself, 2010s: the world’s largest experiment in central-bank ownership of government debt.',
      note: 'Highest debt among majors, financed domestically and by the BoJ. The risk is the exit: rising yields on a 235 % debt stock.' },
    { iso: 'IND', num: 356, name: 'India', gdp: 4100, growth: 6.6, infl: 2.8, debt: 81, bal: -7.5, ca: -0.8, unemp: 4.9, gini: 32.8, y10: 6.5, cb: 20,
      det: [55, 55, 50, 50, 60, 30, 3], trend: 1, ic: 4, ec: 5, stage: 2.3, hidden: 0,
      analog: 'China in the 2000s, earlier in its build-out.',
      note: 'Fast growth, young demographics and rising infrastructure investment; high real rates and large general-government deficits are the watch items.' },
    { iso: 'GBR', num: 826, name: 'United Kingdom', gdp: 3800, growth: 1.3, infl: 3.4, debt: 102, bal: -4.8, ca: -2.5, unemp: 4.7, gini: 32.4, y10: 4.6, cb: 28,
      det: [85, 80, 75, 55, 60, 85, 8], trend: -1, ic: 5, ec: 3, stage: 4.7, hidden: 0,
      analog: 'Britain 1960s–70s: a former reserve-currency power with weak productivity and a gilt-market squeeze.',
      note: 'A former empire with a strong financial centre, weak productivity growth and a bond market that punishes fiscal slippage.' },
    { iso: 'FRA', num: 250, name: 'France', gdp: 3200, growth: 0.7, infl: 1.0, debt: 116, bal: -5.4, ca: -0.8, unemp: 7.5, gini: 31.5, y10: 3.5, cb: 38,
      det: [78, 72, 70, 55, 62, 55, 12], trend: -1, ic: 7, ec: 3, stage: 4.8, hidden: 0,
      analog: 'Late-1780s France: fiscal stress meeting political fragmentation.',
      note: 'High debt and persistent deficits collide with a fragmented parliament; the ECB backstop caps the spread but not the political risk.' },
    { iso: 'ITA', num: 380, name: 'Italy', gdp: 2400, growth: 0.5, infl: 1.7, debt: 137, bal: -3.0, ca: 1.0, unemp: 6.1, gini: 32.7, y10: 3.5, cb: 38,
      det: [70, 60, 60, 50, 40, 35, 10], trend: -1, ic: 4, ec: 2, stage: 4.2, hidden: 0,
      analog: 'Itself 1990s: high debt kept serviceable by a primary surplus.',
      note: 'Very high debt, but a primary surplus, long maturities and a domestic holder base have steadied it — slow growth is the weak link.' },
    { iso: 'BRA', fx: 0.05, num: 76, name: 'Brazil', gdp: 2300, growth: 2.4, infl: 5.0, debt: 92, bal: -8.0, ca: -3.0, unemp: 5.8, gini: 52.0, y10: 13.8, cb: 25,
      det: [45, 40, 35, 40, 35, 25, 2], trend: 0, ic: 6, ec: 2, stage: 4.3, hidden: 0,
      analog: 'Itself, 2015–16: real rates above growth and a deteriorating primary balance.',
      note: 'Double-digit real rates make the debt stock expensive to carry; fiscal credibility and the wealth gap dominate the outlook.' },
    { iso: 'CAN', num: 124, name: 'Canada', gdp: 2300, growth: 1.2, infl: 2.0, debt: 111, bal: -1.9, ca: -1.0, unemp: 6.9, gini: 31.7, y10: 3.2, cb: 8,
      det: [85, 70, 72, 55, 35, 55, 4], trend: 0, ic: 4, ec: 4, stage: 3.6, hidden: 0,
      analog: 'Australia 2010s: resource economy with a household-debt overhang.',
      note: 'Government finances are comparatively sound once provincial assets are netted; household debt and trade dependence on the US are the exposures.' },
    { iso: 'RUS', fx: 0.1, num: 643, name: 'Russia', gdp: 2200, growth: 0.6, infl: 8.5, debt: 20, bal: -2.0, ca: 2.5, unemp: 2.3, gini: 36.0, y10: 14.0, cb: 17,
      det: [70, 55, 40, 35, 80, 15, 2], trend: -1, ic: 4, ec: 10, stage: 5.2, hidden: 0,
      analog: '1970s–80s USSR: military burden, sanctions, a commodity-dependent budget.',
      note: 'Low formal debt but a war economy: overheating, 14 % yields, sanctions and capital-market isolation define the cycle.' },
    { iso: 'KOR', num: 410, name: 'South Korea', gdp: 1900, growth: 0.9, infl: 2.1, debt: 54, bal: -1.0, ca: 4.5, unemp: 2.8, gini: 31.4, y10: 2.9, cb: 25,
      det: [88, 88, 78, 65, 55, 50, 2], trend: 0, ic: 5, ec: 6, stage: 3.5, hidden: 0,
      analog: 'Japan in the early 1990s: high-tech export champion with ageing and high household debt.',
      note: 'Technology and export strength with ageing demographics, high household debt and a nuclear-armed neighbour.' },
    { iso: 'AUS', num: 36, name: 'Australia', gdp: 1800, growth: 1.8, infl: 3.0, debt: 49, bal: -2.5, ca: -2.5, unemp: 4.3, gini: 34.3, y10: 4.3, cb: 20,
      det: [82, 65, 72, 45, 35, 50, 3], trend: 0, ic: 3, ec: 4, stage: 3.2, hidden: 0,
      analog: 'Canada: commodity cycle plus a housing-credit cycle.',
      note: 'Low public debt, high household debt and strong dependence on Chinese demand for commodities.' },
    { iso: 'MEX', fx: 0.2, num: 484, name: 'Mexico', gdp: 1800, growth: 0.2, infl: 3.8, debt: 58, bal: -4.0, ca: -0.5, unemp: 2.8, gini: 45.4, y10: 9.0, cb: 12,
      det: [45, 35, 45, 50, 15, 25, 1], trend: 0, ic: 6, ec: 4, stage: 3.5, hidden: 3,
      analog: 'Spain 1990s: integrating with a larger neighbour.',
      note: 'Near-shoring tailwind against trade-policy uncertainty, weak growth and state-oil-company contingent debt.' },
    { iso: 'ESP', num: 724, name: 'Spain', gdp: 1800, growth: 2.9, infl: 2.5, debt: 101, bal: -2.7, ca: 2.5, unemp: 10.5, gini: 33.0, y10: 3.2, cb: 38,
      det: [70, 55, 60, 45, 30, 40, 8], trend: 1, ic: 5, ec: 2, stage: 3.4, hidden: 0,
      analog: 'Itself post-2012: deleveraging completed, now re-growing.',
      note: 'Post-crisis deleveraging has run its course; strong tourism, migration-driven growth and falling deficits.' },
    { iso: 'IDN', fx: 0.3, num: 360, name: 'Indonesia', gdp: 1400, growth: 4.8, infl: 1.7, debt: 40, bal: -2.7, ca: -0.6, unemp: 4.8, gini: 38.3, y10: 6.5, cb: 10,
      det: [45, 40, 50, 40, 30, 20, 1], trend: 1, ic: 4, ec: 3, stage: 2.4, hidden: 0,
      analog: 'Korea in the 1980s: resource-rich industrialiser.',
      note: 'Young, resource-rich and growing; fiscal-rule credibility and currency volatility are the risks.' },
    { iso: 'TUR', fx: 0.5, num: 792, ieff: 11, name: 'Türkiye', gdp: 1400, growth: 3.2, infl: 33.0, debt: 26, bal: -4.5, ca: -1.5, unemp: 8.6, gini: 43.5, y10: 30.0, cb: 25,
      det: [55, 45, 50, 40, 45, 20, 1], trend: 0, ic: 6, ec: 6, stage: 4.6, hidden: 0,
      analog: 'Itself, 2018–2021: lira crisis and unorthodox policy, now normalising.',
      note: 'Low debt but chronic inflation and currency debasement; credibility is being rebuilt through very high real rates.' },
    { iso: 'SAU', num: 682, name: 'Saudi Arabia', gdp: 1100, growth: 3.5, infl: 2.2, debt: 30, bal: -3.0, ca: -2.5, unemp: 3.4, gini: 45.0, y10: 5.0, cb: 15,
      det: [50, 35, 50, 40, 45, 35, 2], trend: 0, ic: 3, ec: 5, stage: 3.0, hidden: 0,
      analog: 'Norway-in-progress: converting oil wealth into diversified capital.',
      note: 'Oil-price-dependent budget funding a very large diversification programme; peg to the dollar anchors policy.' },
    { iso: 'NLD', num: 528, name: 'Netherlands', gdp: 1300, growth: 1.4, infl: 3.0, debt: 44, bal: -1.5, ca: 9.0, unemp: 3.9, gini: 28.5, y10: 2.8, cb: 38,
      det: [85, 78, 82, 60, 20, 60, 8], trend: 0, ic: 4, ec: 2, stage: 3.4, hidden: 0,
      analog: 'Late-1700s Dutch Republic is the cautionary reference — today a trade-and-finance hub with sound public finances.',
      note: 'Open trading and financial hub with low public debt and a large current-account surplus.' },
    { iso: 'CHE', num: 756, name: 'Switzerland', gdp: 1000, growth: 1.0, infl: 0.2, debt: 36, bal: -0.3, ca: 7.0, unemp: 4.5, gini: 33.1, y10: 0.3, cb: 90,
      det: [90, 92, 88, 55, 15, 85, 6], trend: 0, ic: 2, ec: 1, stage: 3.0, hidden: 0,
      analog: 'Itself: perennial safe haven.',
      note: 'Safe-haven currency, low debt and high productivity; the SNB’s oversized balance sheet is a legacy of defending the franc.' },
    { iso: 'ARG', fx: 0.65, num: 32, ieff: 1.5, name: 'Argentina', gdp: 650, growth: 4.5, infl: 40.0, debt: 85, bal: 0.5, ca: -1.0, unemp: 7.5, gini: 41.4, y10: 35.0, cb: 10,
      det: [60, 35, 25, 20, 10, 15, 1], trend: 0, ic: 7, ec: 2, stage: 5.5, hidden: 0,
      analog: 'Itself, 1989–91 → 2002: serial restructurings, now a fiscal-surplus stabilisation.',
      note: 'Serial defaulter now running a fiscal surplus and disinflating; the question is whether the reset holds without a new shock.' },
    { iso: 'ZAF', fx: 0.1, num: 710, name: 'South Africa', gdp: 400, growth: 1.1, infl: 3.4, debt: 77, bal: -5.5, ca: -0.5, unemp: 32.8, gini: 63.0, y10: 10.0, cb: 7,
      det: [40, 40, 40, 30, 20, 30, 1], trend: 0, ic: 7, ec: 2, stage: 4.5, hidden: 0,
      analog: 'Latin-American cycle: extreme wealth gap with a heavy interest burden.',
      note: 'The world’s widest wealth gap, 33 % unemployment and an interest bill that crowds out spending.' },
    { iso: 'POL', num: 616, name: 'Poland', gdp: 900, growth: 3.2, infl: 3.6, debt: 58, bal: -6.5, ca: -1.5, unemp: 3.2, gini: 27.0, y10: 5.5, cb: 18,
      det: [72, 52, 58, 40, 40, 25, 1], trend: 1, ic: 5, ec: 6, stage: 3.0, hidden: 0,
      analog: 'Korea in the 1990s: convergence story with large defence outlays.',
      note: 'Strong convergence growth but a very large deficit driven by defence and social spending.' }
  ];

  /* Dalio-style long-term debt cycle phases (my labelling of the stages in his debt-crisis template). */
  BCM.PHASES = {
    1: { name: 'Early cycle', short: 'Early', color: '#2dd4a7', blurb: 'Debt is low relative to income; credit creates productive assets and income growth outpaces debt service.' },
    2: { name: 'Debt build-up', short: 'Build-up', color: '#a3d94b', blurb: 'Debt grows faster than income. Borrowing funds consumption and asset purchases; the economy feels strong.' },
    3: { name: 'Top / late cycle', short: 'Top', color: '#f5b83d', blurb: 'Debt service claims a large share of income, asset prices are stretched and borrowers rely on new debt to service old debt.' },
    4: { name: 'Deflationary squeeze', short: 'Squeeze', color: '#5aa9ff', blurb: 'Credit contracts, incomes fall, prices soften. Debt-to-income stays high as deleveraging struggles.' },
    5: { name: 'Money printing', short: 'Printing', color: '#ff7a45', blurb: 'Central bank creates money to buy debt and fund deficits; the currency and bonds are debased to relieve the debt burden.' },
    6: { name: 'Reset / restructuring', short: 'Reset', color: '#a58bff', blurb: 'Debts are restructured, written down or inflated away; a new, sounder regime begins.' }
  };

  /* Dalio's six-stage internal-order Big Cycle. */
  BCM.STAGES = {
    1: { short: 'New order', name: 'New order', color: '#2dd4a7', blurb: 'A new leader consolidates power after conflict; wealth and political gaps are small, cooperation is high.' },
    2: { short: 'Build-out', name: 'Build-out & efficiency', color: '#7bd957', blurb: 'Education, productivity and infrastructure are prioritised; resources are allocated efficiently and incomes rise.' },
    3: { short: 'Peak', name: 'Peak prosperity', color: '#f5d33d', blurb: 'Peak power and wealth; success breeds complacency, borrowing and rising inequality.' },
    4: { short: 'Excesses', name: 'Excesses & debt', color: '#f5a13d', blurb: 'Spending and debt run ahead of income; the wealth gap widens and the currency starts to be questioned.' },
    5: { short: 'Conflict', name: 'Bad finances & conflict', color: '#ff6a45', blurb: 'Debt burdens bind, money is printed, populism and internal conflict intensify, external rivalry sharpens.' },
    6: { short: 'Revolution', name: 'Revolution / war', color: '#e5385a', blurb: 'Polarisation breaks the system; civil conflict or war and a financial reset lead to a new order.' }
  };

  BCM.DETERMINANTS = ['Education', 'Innovation & technology', 'Competitiveness', 'Output', 'Trade', 'Military', 'Financial centre', 'Reserve currency'];

  BCM.RISK_FACTORS = [
    { key: 'debt', label: 'Debt level', w: 14, hint: 'Gross government debt / GDP, discounted for reserve-currency status.' },
    { key: 'deficit', label: 'Fiscal deficit', w: 12, hint: 'Net borrowing as % of GDP — how fast debt is being added.' },
    { key: 'service', label: 'Debt service', w: 14, hint: 'Estimated interest bill / GDP and the gap between interest rate and nominal growth (r − g).' },
    { key: 'macro', label: 'Growth & inflation', w: 14, hint: 'Distance of inflation from 2.5 % and shortfall of real growth from 3 %.' },
    { key: 'external', label: 'External & currency', w: 10, hint: 'Current-account deficit and inflation-driven currency debasement.' },
    { key: 'monetise', label: 'Money printing', w: 8, hint: 'Central-bank balance sheet / GDP and above-target inflation.' },
    { key: 'internal', label: 'Internal conflict', w: 14, hint: 'Political polarisation (analyst score) blended with the wealth gap (Gini).' },
    { key: 'geo', label: 'External conflict', w: 14, hint: 'Geopolitical rivalry exposure (analyst score) and the power trajectory.' }
  ];

  BCM.BANDS = [
    { max: 28, label: 'Low', color: '#2dd4a7' },
    { max: 38, label: 'Moderate', color: '#a3d94b' },
    { max: 48, label: 'Elevated', color: '#f5b83d' },
    { max: 58, label: 'High', color: '#ff7a45' },
    { max: 101, label: 'Critical', color: '#e5385a' }
  ];

  BCM.SCENARIOS = {
    base: { name: 'Base case', desc: 'Current policy, rates reprice to market over ~8 years.', dg: 0, di: 0, dr: 0, dpb: 0, repress: false, color: '#5aa9ff' },
    consolidate: { name: 'Beautiful deleveraging', desc: 'Primary balance improves by 3 pts of GDP over 5 years; slightly lower growth and inflation.', dg: -0.4, di: -0.3, dr: -0.3, dpb: 3, repress: false, color: '#2dd4a7' },
    stress: { name: 'Rates & recession', desc: 'Yields +2 pts, growth −1.5 pts, deficit widens 1 pt of GDP.', dg: -1.5, di: 0, dr: 2, dpb: -1, repress: false, color: '#e5385a' },
    print: { name: 'Print & repress', desc: 'Inflation +4 pts while the central bank holds borrowing costs down — debt melts, savers lose.', dg: 0.2, di: 4, dr: 0, dpb: 0, repress: true, color: '#ff7a45' },
    boom: { name: 'Productivity boom', desc: 'Growth +1.2 pts from technology and reform; rates +0.3 pt.', dg: 1.2, di: 0.2, dr: 0.3, dpb: 0.5, repress: false, color: '#a58bff' }
  };

  /* Book explorer — concise paraphrases of Dalio's published frameworks (not quotations, no page numbers). */
  BCM.CONCEPTS = [
    { id: 'c1', part: 'Foundations', title: 'Three Big Cycles move together',
      body: 'Dalio argues that history is driven by three interacting forces: the long-term debt/money/credit cycle, the internal order–disorder cycle (wealth gaps, polarisation, political conflict), and the external order–disorder cycle (rise and decline of great powers). Add acts of nature (pandemics, droughts) and human inventiveness (technology) and you have the main drivers.',
      measure: 'Overview map: switch between “Debt phase” and “Big Cycle stage”. Each country gets both.',
      watch: ['Debt & deficits (cycle 1)', 'Gini / polarisation (cycle 2)', 'Rival-power conflict (cycle 3)'] },
    { id: 'c2', part: 'Foundations', title: 'Debt is a claim on future money — and a promise',
      body: 'Debt is created when someone borrows against future income. It feels like wealth to the lender and like spending power to the borrower, until the promised payments exceed the money available. The central question is never “how much debt?” alone but “how much debt service relative to income?”.',
      measure: 'Debt Service factor: estimated interest bill / GDP and the r − g gap.',
      watch: ['Interest bill / GDP', 'Interest rate minus nominal growth (r − g)', 'Share of revenue consumed by interest'] },
    { id: 'c3', part: 'Debt cycle', title: 'The long-term debt cycle in six phases',
      body: 'Early cycle (sound money, little debt) → debt build-up (credit outruns income) → top (debt service burdens, stretched assets) → squeeze/deleveraging (deflationary) → money printing (central bank monetises debt, currency debased) → reset/restructuring. Reserve-currency countries can stretch each phase longer than others.',
      measure: 'Cycle Lab: each country is placed on the stylised debt curve with its position inside the phase.',
      watch: ['Debt / GDP trend', 'Inflation regime', 'Central-bank balance sheet / GDP'] },
    { id: 'c4', part: 'Debt cycle', title: 'Supply and demand for debt',
      body: 'Governments that spend more than they tax must sell debt. When more debt is offered than buyers want at acceptable yields, one of three things happens: yields rise, the central bank buys the surplus (printing), or the currency falls. Dalio calls an inability to sell debt without these side effects the crux of a “debt crisis”.',
      measure: 'Money Printing factor and the Print & repress scenario in the simulator.',
      watch: ['Auction demand & term premia', 'Central bank holdings of government bonds', 'Foreign share of holders'] },
    { id: 'c5', part: 'Debt cycle', title: 'The four levers to ease a debt burden',
      body: 'Authorities have four tools: austerity (spend less), default/restructure (debt is written down), redistribute wealth (tax the rich), and print money (devalue the debt). Deflationary tools hurt growth; inflationary tools hurt creditors. The art is a “beautiful deleveraging” — balancing them so debt/income falls without chaos.',
      measure: 'Debt Simulator scenarios: Beautiful deleveraging, Rates & recession, Print & repress.',
      watch: ['Primary balance', 'Tax-policy shifts', 'Central bank independence'] },
    { id: 'c6', part: 'Debt cycle', title: 'Reserve currencies buy time, not immunity',
      body: 'A currency used for global trade, savings and debt gets unusually cheap funding. History (Dutch guilder, sterling) shows reserve status erodes when debt is excessive, competitiveness fades and a rival rises — typically slowly, then quickly.',
      measure: 'Risk model gives reserve-currency countries a partial discount; Power Index includes the reserve-currency determinant.',
      watch: ['Reserve share of the USD', 'Gold & alternative-store-of-value prices', 'Sanctions use'] },
    { id: 'c7', part: 'Internal order', title: 'Six stages of the internal order cycle',
      body: 'New order → build-out → peak → excesses & debt → bad financial conditions with conflict → revolution/civil conflict and new order. Wealth gaps and political polarisation widen through the middle stages, because the same forces that create prosperity create inequality.',
      measure: 'Big Cycle stage map and arc; stage values come from analyst judgement plus live Gini and debt data.',
      watch: ['Wealth gap (Gini)', 'Populism & polarisation', 'Willingness to compromise'] },
    { id: 'c8', part: 'Internal order', title: 'Wealth, values and political gaps',
      body: 'When wealth and values gaps grow and the economy deteriorates, people choose strong leaders and fight more. High-conflict periods come with money-printing, protectionism, capital controls and more executive power.',
      measure: 'Internal Conflict factor — analyst score blended with Gini.',
      watch: ['Gini coefficient', 'Election margins & turnover', 'Protest & strike intensity'] },
    { id: 'c9', part: 'External order', title: 'Rise and decline of empires: eight determinants of power',
      body: 'Dalio tracks power through eight gauges: education, innovation & technology, competitiveness, economic output, share of world trade, military strength, financial-centre strength and reserve-currency status. Empires rise on the first group, peak when all are aligned, and decline when debts, internal conflict and a rival erode them.',
      measure: 'Country page radar, and the Power Index (equal-weighted average).',
      watch: ['Relative patent / R&D share', 'Trade share', 'Currency share in reserves & payments'] },
    { id: 'c10', part: 'External order', title: 'Conflict, sanctions and the new world order',
      body: 'Great-power rivalry intensifies when a rising power challenges the leader. Financial weapons (sanctions, capital controls, asset freezes) are used before military ones and undermine trust in the leader’s currency.',
      measure: 'External Conflict factor and the power-trend arrow.',
      watch: ['Sanctions regimes', 'Tariffs & export controls', 'Military spending share'] },
    { id: 'c11', part: 'Reading the cycle', title: 'Markets signal the phase',
      body: 'Gold tends to rise against paper money when trust in debt erodes; long-term yields rise when supply of debt outruns demand; the currency falls when the central bank prints. Combining these with debt-service data gives a more reliable read than any one indicator.',
      measure: 'Live ticker: Gold, BTC, USD crosses, US debt counter, and (if reachable) the US 10-year yield.',
      watch: ['Gold in USD & vs other currencies', '10y – 2y spread', 'Currency YTD moves'] },
    { id: 'c12', part: 'Reading the cycle', title: 'Practical principles for investors',
      body: 'Do not hold too much of anything that is a promise by a heavily indebted issuer; diversify across currencies, asset classes and countries; hold some assets that do well when money is debased (gold, inflation-linked assets). The All-Weather portfolio is one expression of this idea.',
      measure: 'Compare page and Risk Matrix for cross-country diversification thinking.',
      watch: ['Concentration in one currency', 'Real yield on bonds', 'Correlation of assets in stress'] }
  ];

  BCM.SOURCES = [
    { id: 'imf', name: 'IMF DataMapper (WEO)', what: 'Growth, inflation, debt, deficit, current account, unemployment, GDP — with forecasts to 2031', url: 'https://www.imf.org/external/datamapper/api/v1/' },
    { id: 'wb', name: 'World Bank API', what: 'Gini index; fallback for growth, inflation, debt, GDP', url: 'https://api.worldbank.org/v2/' },
    { id: 'ust', name: 'US Treasury FiscalData', what: 'Debt to the penny, average interest rate', url: 'https://api.fiscaldata.treasury.gov/' },
    { id: 'fx', name: 'Frankfurter / ER-API', what: 'FX rates vs USD, year-to-date change', url: 'https://api.frankfurter.dev/' },
    { id: 'btc', name: 'Coinbase spot', what: 'BTC-USD', url: 'https://api.coinbase.com/v2/prices/BTC-USD/spot' },
    { id: 'gold', name: 'Gold-API', what: 'XAU/USD spot', url: 'https://api.gold-api.com/price/XAU' },
    { id: 'fred', name: 'FRED CSV', what: 'US 10y and 2y Treasury yields (may be blocked by CORS)', url: 'https://fred.stlouisfed.org/graph/fredgraph.csv' }
  ];
})(window);
