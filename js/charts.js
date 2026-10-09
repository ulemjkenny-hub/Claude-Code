/* Big Cycle Monitor — D3 chart helpers. */
(function (g) {
  const BCM = (g.BCM = g.BCM || {});
  const C = (BCM.charts = {});
  const $ = (s, r) => (typeof s === 'string' ? (r || document).querySelector(s) : s);

  /* ---------- tooltip ---------- */
  const tip = (C.tip = {
    el: null,
    show(html, ev) {
      if (!tip.el) { tip.el = document.createElement('div'); tip.el.className = 'tip'; tip.el.setAttribute('role', 'tooltip'); document.body.appendChild(tip.el); }
      tip.el.innerHTML = html; tip.el.style.display = 'block';
      tip.move(ev);
    },
    move(ev) {
      if (!tip.el) return;
      const w = tip.el.offsetWidth, h = tip.el.offsetHeight;
      let x = ev.clientX + 14, y = ev.clientY + 14;
      if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
      if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
      tip.el.style.left = Math.max(4, x) + 'px'; tip.el.style.top = Math.max(4, y) + 'px';
    },
    hide() { if (tip.el) tip.el.style.display = 'none'; }
  });

  const width = (el, min = 280) => Math.max(min, el.clientWidth || 600);
  const cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /* ---------- multi-series line chart ---------- */
  C.line = function (sel, series, o = {}) {
    const el = $(sel); if (!el) return;
    el.innerHTML = '';
    const W = width(el), H = o.height || 260, m = { t: 14, r: o.endLabels ? 96 : 16, b: 26, l: o.left || 46 };
    const all = series.flatMap((s) => s.pts);
    const xs = d3.extent(all, (d) => d[0]);
    let ys = o.yDomain || d3.extent(all, (d) => d[1]);
    if (!o.yDomain) { if (ys[1] - ys[0] < (o.minSpan || 0)) { const mid = (ys[0] + ys[1]) / 2; ys = [mid - o.minSpan / 2, mid + o.minSpan / 2]; } const pad = (ys[1] - ys[0]) * 0.1 || 1; ys = [ys[0] - pad, ys[1] + pad]; if (o.zero) ys[0] = Math.min(0, ys[0]); }
    const x = d3.scaleLinear().domain(xs).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain(ys).nice().range([H - m.b, m.t]);
    const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', o.label || 'line chart');
    svg.append('g').attr('class', 'grid').selectAll('line').data(y.ticks(5)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(Math.min(10, xs[1] - xs[0])).tickFormat(d3.format('d')).tickSizeOuter(0));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(o.yFmt || ((d) => d)).tickSize(0).tickPadding(8)).select('.domain').remove();
    (o.refLines || []).forEach((r) => {
      if (r.y < y.domain()[0] || r.y > y.domain()[1]) return;
      svg.append('line').attr('class', 'ref').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(r.y)).attr('y2', y(r.y));
      svg.append('text').attr('class', 'reflabel').attr('x', m.l + 4).attr('y', y(r.y) - 4).text(r.label);
    });
    if (o.xMark != null) svg.append('line').attr('class', 'ref').attr('x1', x(o.xMark)).attr('x2', x(o.xMark)).attr('y1', m.t).attr('y2', H - m.b);
    const ln = d3.line().x((d) => x(d[0])).y((d) => y(d[1])).curve(d3.curveMonotoneX).defined((d) => d[1] != null && !isNaN(d[1]));
    series.forEach((s) => {
      svg.append('path').datum(s.pts).attr('class', 'ln').attr('d', ln).attr('stroke', s.color).attr('stroke-width', s.width || 2.2).attr('stroke-dasharray', s.dash || null).attr('fill', 'none');
    });
    if (o.endLabels) {
      const lab = series.map((s) => { const last = s.pts[s.pts.length - 1]; return { s, y: y(last[1]) + 4, x: x(last[0]) + 6 }; }).sort((a, b) => a.y - b.y);
      for (let k = 1; k < lab.length; k++) if (lab[k].y - lab[k - 1].y < 12) lab[k].y = lab[k - 1].y + 12;
      lab.forEach((l) => svg.append('text').attr('class', 'endlab').attr('x', l.x).attr('y', l.y).attr('fill', l.s.color).text(l.s.name));
    }
    const rule = svg.append('line').attr('class', 'rule').attr('y1', m.t).attr('y2', H - m.b).style('display', 'none');
    const dots = svg.append('g');
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('mousemove', (ev) => {
        const [mx] = d3.pointer(ev);
        const xv = Math.round(x.invert(mx));
        const rows = series.map((s) => ({ s, p: s.pts.find((p) => p[0] === xv) })).filter((r) => r.p && r.p[1] != null);
        if (!rows.length) return;
        rule.style('display', null).attr('x1', x(xv)).attr('x2', x(xv));
        dots.selectAll('circle').data(rows).join('circle').attr('r', 3.6).attr('cx', x(xv)).attr('cy', (r) => y(r.p[1])).attr('fill', (r) => r.s.color).attr('stroke', cssv('--bg'));
        tip.show(`<b>${xv}</b>` + rows.map((r) => `<div class="trow"><i style="background:${r.s.color}"></i>${r.s.name}<span>${(o.tipFmt || o.yFmt || ((d) => d.toFixed(1)))(r.p[1])}</span></div>`).join(''), ev);
      })
      .on('mouseleave', () => { rule.style('display', 'none'); dots.selectAll('*').remove(); tip.hide(); });
  };

  /* ---------- radar ---------- */
  C.radar = function (sel, axes, series, o = {}) {
    const el = $(sel); if (!el) return; el.innerHTML = '';
    const W = width(el, 260), H = o.height || Math.min(330, W), R = Math.min(W, H) / 2 - 46, cx = W / 2, cy = H / 2;
    const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', o.label || 'radar chart');
    const n = axes.length, ang = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
    [25, 50, 75, 100].forEach((v) => svg.append('polygon').attr('class', 'ring').attr('points', axes.map((_, i) => [cx + (R * v / 100) * Math.cos(ang(i)), cy + (R * v / 100) * Math.sin(ang(i))].join(',')).join(' ')));
    axes.forEach((a, i) => {
      svg.append('line').attr('class', 'spoke').attr('x1', cx).attr('y1', cy).attr('x2', cx + R * Math.cos(ang(i))).attr('y2', cy + R * Math.sin(ang(i)));
      const lx = cx + (R + 14) * Math.cos(ang(i)), ly = cy + (R + 14) * Math.sin(ang(i));
      svg.append('text').attr('class', 'radlab').attr('x', lx).attr('y', ly + 3).attr('text-anchor', Math.abs(lx - cx) < 6 ? 'middle' : lx > cx ? 'start' : 'end').text(a);
    });
    series.forEach((s) => {
      const pts = s.vals.map((v, i) => [cx + (R * Math.max(2, v) / 100) * Math.cos(ang(i)), cy + (R * Math.max(2, v) / 100) * Math.sin(ang(i))]);
      svg.append('polygon').attr('points', pts.map((p) => p.join(',')).join(' ')).attr('fill', s.color).attr('fill-opacity', 0.16).attr('stroke', s.color).attr('stroke-width', 2);
      svg.selectAll(null).data(pts).join('circle').attr('cx', (d) => d[0]).attr('cy', (d) => d[1]).attr('r', 3).attr('fill', s.color)
        .on('mousemove', (ev, d) => { const i = pts.indexOf(d); tip.show(`<b>${s.name}</b><div>${axes[i]}: ${s.vals[i].toFixed(0)}/100</div>`, ev); }).on('mouseleave', tip.hide);
    });
  };

  /* ---------- risk gauge ---------- */
  C.gauge = function (sel, value, o = {}) {
    const el = $(sel); if (!el) return; el.innerHTML = '';
    const W = width(el, 200), H = Math.round(W * 0.58), R = Math.min(W / 2 - 10, H - 18), cx = W / 2, cy = H - 10;
    const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', `Risk gauge ${value.toFixed(0)} of 100`);
    const a = d3.scaleLinear().domain([0, 100]).range([-Math.PI / 2, Math.PI / 2]);
    let lo = 0;
    BCM.BANDS.forEach((b) => {
      const hi = Math.min(100, b.max);
      svg.append('path').attr('transform', `translate(${cx},${cy})`).attr('d', d3.arc().innerRadius(R * 0.74).outerRadius(R).startAngle(a(lo) + 0.008).endAngle(a(hi) - 0.008)()).attr('fill', b.color).attr('opacity', 0.9);
      lo = hi;
    });
    const ang = a(Math.min(100, value));
    svg.append('line').attr('x1', cx).attr('y1', cy).attr('x2', cx + (R * 0.68) * Math.sin(ang)).attr('y2', cy - (R * 0.68) * Math.cos(ang)).attr('stroke', cssv('--fg')).attr('stroke-width', 3).attr('stroke-linecap', 'round');
    svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 6).attr('fill', cssv('--fg'));
  };

  /* ---------- stylised cycle curve with country bubbles ---------- */
  function curveKeys(kind) {
    return kind === 'debt'
      ? [[0, 0.16], [1, 0.3], [2, 0.6], [3, 1.0], [4, 0.88], [5, 0.62], [6, 0.28]]
      : [[0, 0.14], [1, 0.5], [2, 0.9], [2.6, 1.0], [3, 0.95], [4, 0.72], [5, 0.42], [6, 0.1]];
  }

  C.cycle = function (sel, items, o = {}) {
    const el = $(sel); if (!el) return; el.innerHTML = '';
    const kind = o.kind || 'debt', names = kind === 'debt' ? BCM.PHASES : BCM.STAGES;
    const W = width(el, 320), H = o.height || 330, m = { t: 46, r: 12, b: 22, l: 12 };
    const x = d3.scaleLinear().domain([0, 6]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, 1.15]).range([H - m.b, m.t]);
    const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', kind === 'debt' ? 'Long-term debt cycle' : 'Big cycle stages');
    for (let i = 1; i <= 6; i++) {
      svg.append('rect').attr('x', x(i - 1)).attr('y', m.t - 10).attr('width', x(i) - x(i - 1)).attr('height', H - m.b - m.t + 10).attr('fill', names[i].color).attr('opacity', 0.07);
      svg.append('text').attr('class', 'phlab').attr('x', (x(i - 1) + x(i)) / 2).attr('y', 18).attr('text-anchor', 'middle').attr('fill', names[i].color).text(`${i}`);
      svg.append('text').attr('class', 'phname').attr('x', (x(i - 1) + x(i)) / 2).attr('y', 33).attr('text-anchor', 'middle').text(names[i].short || names[i].name);
    }
    const keys = curveKeys(kind);
    const line = d3.line().x((d) => x(d[0])).y((d) => y(d[1])).curve(d3.curveMonotoneX);
    const path = svg.append('path').attr('class', 'curve').attr('d', line(keys));
    const node = path.node(), L = node.getTotalLength();
    const yAtX = (xp) => { let lo = 0, hi = L; for (let k = 0; k < 28; k++) { const mid = (lo + hi) / 2; if (node.getPointAtLength(mid).x < xp) lo = mid; else hi = mid; } return node.getPointAtLength(hi).y; };
    const nodes = items.map((it) => ({ ...it, tx: x(Math.max(0.12, Math.min(5.88, it.x))), r: it.hl ? 13 : (o.compact ? 9 : 10.5) }));
    nodes.forEach((n) => { n.ty = yAtX(n.tx) - n.r - 6; n.x = n.tx; n.y = n.ty; });
    const sim = d3.forceSimulation(nodes).force('x', d3.forceX((n) => n.tx).strength(1)).force('y', d3.forceY((n) => n.ty).strength(0.12)).force('c', d3.forceCollide((n) => n.r + 1.5)).stop();
    for (let k = 0; k < 240; k++) sim.tick();
    nodes.forEach((n) => { n.y = Math.min(n.y, yAtX(n.tx) - n.r - 2); });
    const gN = svg.selectAll('g.nd').data(nodes).join('g').attr('class', (n) => 'nd' + (n.hl ? ' hl' : '') + (o.dim && !n.hl ? ' dim' : '')).attr('transform', (n) => `translate(${n.x},${n.y})`).style('cursor', 'pointer');
    gN.append('circle').attr('r', (n) => n.r).attr('fill', (n) => n.color).attr('stroke', cssv('--bg')).attr('stroke-width', 1.5);
    gN.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('class', 'nlab').style('font-size', (n) => (n.r > 11 ? 9 : 8) + 'px').text((n) => n.iso);
    gN.on('mousemove', (ev, n) => tip.show(n.tip || n.iso, ev)).on('mouseleave', tip.hide).on('click', (ev, n) => o.onClick && o.onClick(n));
    svg.append('text').attr('class', 'axislab').attr('x', m.l).attr('y', H - 6).text(kind === 'debt' ? 'Debt burden relative to income →' : 'Relative power & cohesion →');
    svg.append('text').attr('class', 'axislab').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').text('time →');
  };

  /* ---------- world choropleth ---------- */
  C.map = function (sel, recs, metric, o = {}) {
    const el = $(sel); if (!el) return;
    el.innerHTML = '';
    const W = width(el, 320), H = Math.round(Math.min(W * 0.52, 560));
    const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('class', 'mapsvg').attr('role', 'img').attr('aria-label', 'World map coloured by ' + metric.label);
    const feats = topojson.feature(WORLD_TOPO, WORLD_TOPO.objects.countries).features.filter((f) => f.id !== '010');
    const proj = d3.geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: 'FeatureCollection', features: feats });
    const path = d3.geoPath(proj);
    const byNum = new Map(recs.map((r) => [r.num, r]));
    const root = svg.append('g');
    svg.append('path').attr('d', path({ type: 'Sphere' })).attr('class', 'sphere').lower();
    const paths = root.selectAll('path.cty').data(feats).join('path').attr('class', (f) => 'cty' + (byNum.has(+f.id) ? ' tracked' : ''))
      .attr('d', path)
      .style('fill', (f) => { const r = byNum.get(+f.id); return r ? metric.color(r) : null; });
    paths.filter((f) => byNum.has(+f.id)).attr('tabindex', 0)
      .attr('role', 'link').attr('aria-label', (f) => byNum.get(+f.id).name)
      .on('mousemove', (ev, f) => tip.show(o.tip(byNum.get(+f.id)), ev))
      .on('mouseleave', tip.hide)
      .on('click', (ev, f) => o.onClick && o.onClick(byNum.get(+f.id)))
      .on('keydown', (ev, f) => { if (ev.key === 'Enter') o.onClick && o.onClick(byNum.get(+f.id)); });
    const labs = root.selectAll('text.mlab').data(feats.filter((f) => byNum.has(+f.id))).join('text').attr('class', 'mlab').attr('pointer-events', 'none')
      .attr('transform', (f) => { const c = path.centroid(f); const r = byNum.get(+f.id); const off = ({ FRA: [8, 4], USA: [-30, 8], NLD: [3, -8], CHE: [3, 6], ITA: [4, 6], AUS: [0, 0], CAN: [0, 14], RUS: [-60, 18], SAU: [0, 0], POL: [4, -5], GBR: [-5, 0], ESP: [-6, 4] })[r.iso] || [0, 0]; return `translate(${c[0] + off[0]},${c[1] + off[1]})`; })
      .attr('text-anchor', 'middle').text((f) => byNum.get(+f.id).iso);
    const zoom = d3.zoom().scaleExtent([1, 9]).translateExtent([[0, 0], [W, H]]).on('zoom', (ev) => {
      root.attr('transform', ev.transform);
      root.selectAll('path.cty').attr('stroke-width', 0.5 / ev.transform.k);
      labs.style('font-size', Math.max(5, 9 / Math.sqrt(ev.transform.k)) + 'px').style('opacity', ev.transform.k > 1.6 || W > 700 ? 1 : 0);
    });
    svg.call(zoom).on('dblclick.zoom', null);
    labs.style('font-size', '9px').style('opacity', W > 700 ? 1 : 0);
    const host = el.parentElement.querySelector('.mapctl');
    if (host) {
      host.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const a = b.dataset.z; if (a === 'in') svg.transition().duration(250).call(zoom.scaleBy, 1.6); else if (a === 'out') svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.6); else svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity); };
    }
  };

  /* ---------- small helpers ---------- */
  C.sparkline = function (sel, vals, color) {
    const el = $(sel); if (!el || !vals.length) return; el.innerHTML = '';
    const W = el.clientWidth || 120, H = el.clientHeight || 28;
    const x = d3.scaleLinear().domain([0, vals.length - 1]).range([2, W - 2]);
    const y = d3.scaleLinear().domain(d3.extent(vals)).range([H - 3, 3]);
    d3.select(el).append('svg').attr('width', W).attr('height', H).append('path').datum(vals).attr('d', d3.line().x((d, i) => x(i)).y(y)).attr('fill', 'none').attr('stroke', color || cssv('--accent')).attr('stroke-width', 1.5);
  };
})(window);
