# Big Cycle Monitor

A static, build-free dashboard that places the world's largest economies on Ray Dalio's two Big Cycles
(the long-term debt cycle and the internal order/disorder cycle), scores their risk and projects their debt.

## Run

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Any static host works (GitHub Pages, Netlify, S3). No build step; D3, topojson and the world map are vendored in `js/vendor` and `data/`.

## Views
- **Overview** – world map (10 switchable metrics), league table, phase mix, auto alerts, live ticker.
- **Country page** – debt phase, Big Cycle stage, risk gauge/decomposition, power radar, 5 debt scenarios, IMF outlook, analyst what-if overrides.
- **Cycle Lab** – all economies on both cycle curves + a debt simulator (growth, inflation, yields, primary balance, financial repression).
- **Risk & Forecast** – 8-factor heat-map with editable weights, 5/10-year forecast and phase-transition table.
- **Compare**, **Book Explorer** (framework notes + your own page/notes log), **Method & Sources**.

## Live data
Fetched in the browser; each feed degrades independently to an embedded snapshot, and the header pill shows which is which.
IMF DataMapper (macro + forecasts) → World Bank fallback · World Bank Gini · US Treasury FiscalData · Frankfurter/ER-API FX ·
Coinbase BTC · Gold-API XAU · FRED yields (may be blocked by CORS). Fast feeds refresh every 60 s.

## Honesty notes
- Snapshot numbers in `js/data.js` are approximate fallbacks, not official statistics.
- Stage, conflict scores, power determinants and hidden-debt adjustments are analyst judgement, editable in the UI.
- The Book Explorer paraphrases Dalio's published frameworks; it has not ingested any book text and carries no page quotations.
- Not investment advice. Scenario maths is illustrative.

## Layout
`js/data.js` data + definitions · `js/model.js` classifier, risk, projections · `js/live.js` feeds · `js/charts.js` D3 · `js/app.js` views/router.
