/* Nike Profit Detective: sample data generator and algorithm for Nike. */
const TOOL = {
  num: 13, area: "Business Analytics", product: "Profitability Decline Investigation", seed: 131,
  title: "Nike Profit Detective", company: "Nike",
  why: "Nike went through several quarters of falling profit in 2024 and 2025 while individual functions could still point to their own targets being met. This tool joins Marketing, HR, Operations and Finance data to find the cross-team chain behind the decline.",
  statement: "Company profitability has declined for three consecutive quarters, but individual departments report satisfactory performance. Develop an AI business analyst that integrates Marketing, HR, Operations and Finance data to identify cross-functional relationships responsible for the decline.",
  dataNote: "36 months of Marketing, HR, Operations and Finance data for one geography (sample data, $ millions).",
  steps: [
    ["Integrate four functions", "Marketing, HR, Operations and Finance, monthly"],
    ["Department scorecards", "Each team against its own target"],
    ["Profit bridge", "Latest quarter vs a year ago: volume, price, cost, opex"],
    ["Lead-lag links", "Cross-correlations between team metrics at 0 to 3 month lags"],
    ["Cause map", "Keep strong, directional links as a cause chain"],
    ["Margin driver model", "Regression of operating margin on cross-team metrics"],
    ["Find the trade-offs", "Where one team's win is another team's cost"],
    ["Recovery plan", "Simulate coordinated fixes and explain them"]
  ],
  params: [
    { id: "disc", label: "Cut average discount by", min: 0, max: 10, step: 1, value: 4, fmt: v => v + " pts" },
    { id: "inv", label: "Cut excess inventory by", min: 0, max: 60, step: 10, value: 30, fmt: v => v + "%" },
    { id: "hire", label: "Slow hiring growth to", min: 0, max: 8, step: 1, value: 2, fmt: v => v + "% a year" }
  ],
  questions: ["Why is profit falling if every team hit target?", "Who should own the fix?", "What if we stop discounting but sales drop?", "Write the board memo on this"],
  generate(r) {
    const N = 36, mo = S.range(N);
    const over = mo.map(t => t >= 24 ? 0.075 * Math.min(1, (t - 24) / 4) : 0); // operations over-ordered from month 25
    const ordered = mo.map(t => (10 + 0.05 * t) * (1 + over[t]) + r.n(0, 0.2));
    const inv = []; let I = 22;
    const disc = [], units = [], asp = [], rev = [];
    mo.forEach(t => { const dRate = S.clamp(0.12 + 0.014 * Math.max(0, (I - 23)) + r.n(0, 0.005), 0.08, 0.32); const demand = (10 + 0.05 * t) * (1 + 1.4 * (dRate - 0.12)) * (1 + 0.025 * Math.sin(2 * Math.PI * t / 12)) + r.n(0, 0.15); I = Math.max(10, I + ordered[t] - demand); inv.push(I); disc.push(dRate); units.push(demand); asp.push(78 * (1 - dRate)); rev.push(demand * 78 * (1 - dRate)); });
    const cogsU = mo.map(t => 33 + 0.05 * t + r.n(0, 0.4));
    const freight = mo.map((t, i) => units[i] * (3.2 + 0.08 * Math.max(0, inv[i] - 24)) + r.n(0, 0.8));
    const storage = inv.map(v => v * 1.9 + r.n(0, 0.6));
    const mkt = mo.map(t => 95 + 0.6 * t + r.n(0, 3));
    const heads = mo.map(t => 2400 * (1 + 0.075 * t / 12) + r.n(0, 10)); const labor = heads.map(h => h * 0.0105 * (1 + r.n(0, 0.01)));
    const other = mo.map(() => 85 + r.n(0, 4));
    const gross = mo.map(i => rev[i] - units[i] * cogsU[i]);
    const op = mo.map(i => gross[i] - freight[i] - storage[i] - mkt[i] - labor[i] - other[i]);
    return { N, inv, disc, units, asp, rev, cogsU, freight, storage, mkt, heads, labor, other, gross, op, ordered };
  },
  analyze(D, P, r) {
    const N = D.N, q = (a, k) => S.sum(a.slice(k * 3, k * 3 + 3)), Q = S.range(12), qs = Q.map(k => `Q${(k % 4) + 1}'${23 + Math.floor(k / 4)}`);
    const qOp = Q.map(k => q(D.op, k)), qRev = Q.map(k => q(D.rev, k)), qm = Q.map(k => qOp[k] / qRev[k]);
    let streak = 0; for (let k = 11; k > 0 && qOp[k] < qOp[k - 1]; k--) streak++;
    // scorecards: each team's own KPI vs target
    const last = 11, ya = 7;
    const units = Q.map(k => q(D.units, k));
    const cards = [
      { team: "Marketing", kpi: "Unit sales growth vs last year", val: units[last] / units[ya] - 1, target: 0.03, fmt: v => F.pct(v), good: true },
      { team: "Operations", kpi: "On-shelf availability", val: 0.97, target: 0.95, fmt: v => F.pct(v, 0), good: true },
      { team: "HR", kpi: "Hiring plan delivered", val: (D.heads[N - 1] - D.heads[N - 13]) / (D.heads[N - 13] * 0.064), target: 1, fmt: v => F.pct(v, 0), good: true },
      { team: "Finance", kpi: "Cost of goods per unit vs budget", val: (q(D.cogsU, last) / 3) / 35.2 - 1, target: 0.01, fmt: v => F.sgn(v, x => F.pct(x)), good: false }
    ].map(c => ({ ...c, ok: c.good ? c.val >= c.target : c.val <= c.target }));
    // bridge
    const comp = k => ({ units: q(D.units, k), asp: q(D.rev, k) / q(D.units, k), cogs: q(D.cogsU, k) / 3, freight: q(D.freight, k), storage: q(D.storage, k), mkt: q(D.mkt, k), labor: q(D.labor, k), other: q(D.other, k) });
    const a = comp(ya), b = comp(last); const listPrice = 78;
    const volume = (b.units - a.units) * (a.asp - a.cogs);
    const price = b.units * (b.asp - a.asp);
    const cost = -b.units * (b.cogs - a.cogs);
    const bridge = [{ label: "Year ago", value: qOp[ya], total: true }, { label: "Volume", value: volume }, { label: "Discount", value: price }, { label: "COGS", value: cost }, { label: "Freight", value: -(b.freight - a.freight) }, { label: "Storage", value: -(b.storage - a.storage) }, { label: "Mktg", value: -(b.mkt - a.mkt) }, { label: "Labour", value: -(b.labor - a.labor) }, { label: "Other", value: -(b.other - a.other) }];
    bridge.push({ label: "Latest", value: qOp[last], total: true });
    // cross-function links (monthly)
    const ser = { "Inventory level (Ops)": D.inv, "Purchase orders (Ops)": D.ordered, "Discount rate (Mkt)": D.disc, "Unit sales (Mkt)": D.units, "Freight cost (Ops)": D.freight, "Storage cost (Ops)": D.storage, "Headcount (HR)": D.heads, "Labour cost (HR)": D.labor, "Operating margin (Fin)": D.op.map((v, i) => v / D.rev[i]) };
    const names = Object.keys(ser), links = [];
    names.forEach(x => names.forEach(y => { if (x === y || x.split("(")[1] === y.split("(")[1] && !y.includes("Fin")) return; let best = { l: 0, r: 0 }; for (let l = 1; l <= 3; l++) { const rr = S.corr(ser[x].slice(0, N - l), ser[y].slice(l)); if (Math.abs(rr) > Math.abs(best.r)) best = { l, r: rr }; } if (Math.abs(best.r) > 0.6) links.push({ from: x, to: y, lag: best.l, r: best.r }); }));
    const chainKeys = [["Purchase orders (Ops)", "Inventory level (Ops)"], ["Inventory level (Ops)", "Discount rate (Mkt)"], ["Discount rate (Mkt)", "Unit sales (Mkt)"], ["Inventory level (Ops)", "Storage cost (Ops)"], ["Discount rate (Mkt)", "Operating margin (Fin)"], ["Headcount (HR)", "Labour cost (HR)"]];
    const strong = links.filter(l => chainKeys.some(([f, t]) => l.from === f && l.to === t)).sort((a2, b2) => Math.abs(b2.r) - Math.abs(a2.r));
    const extra = links.filter(l => !strong.includes(l) && l.to.includes("margin")).sort((a2, b2) => Math.abs(b2.r) - Math.abs(a2.r)).slice(0, 3);
    // margin model
    const X = S.range(N).map(i => [D.disc[i], D.inv[i], D.labor[i] / D.rev[i], D.freight[i] / D.rev[i]]), y = D.op.map((v, i) => v / D.rev[i]);
    const mdl = M.ols(X, y);
    const sd = [0, 1, 2, 3].map(j => S.sd(X.map(x => x[j]))), stdB = mdl.beta.slice(1).map((bb, j) => bb * sd[j] / S.sd(y));
    // recovery simulation on latest quarter
    const L3 = [N - 3, N - 2, N - 1];
    const sim = L3.map(i => { const d2 = Math.max(0.08, D.disc[i] - P.disc / 100); const u2 = D.units[i] * (1 - 1.4 * (D.disc[i] - d2)); const exI = Math.max(0, D.inv[i] - 24); const inv2 = D.inv[i] - exI * P.inv / 100; const rev2 = u2 * 78 * (1 - d2); const g2 = rev2 - u2 * D.cogsU[i]; const fr2 = u2 * (3.2 + 0.08 * Math.max(0, inv2 - 24)); const st2 = inv2 * 1.9; const lab2 = D.labor[i] * (1 + P.hire / 100 * 0.25) / (1 + 0.075 * 0.25); const clear = exI * P.inv / 100 * D.cogsU[i] * 0.15 / 3; return g2 - fr2 - st2 - D.mkt[i] - lab2 - D.other[i] - clear; });
    const newOp = S.sum(sim), gain = newOp - qOp[last];
    const nodes = names; const pos = { "Purchase orders (Ops)": [80, 60], "Inventory level (Ops)": [250, 60], "Discount rate (Mkt)": [420, 60], "Unit sales (Mkt)": [580, 60], "Storage cost (Ops)": [250, 190], "Freight cost (Ops)": [80, 190], "Operating margin (Fin)": [420, 190], "Headcount (HR)": [580, 250], "Labour cost (HR)": [580, 150] };
    const net = (() => { let g = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--ink)"/></marker></defs>`; [...strong, ...extra].forEach(l => { const [x1, y1] = pos[l.from], [x2, y2] = pos[l.to]; const dx = x2 - x1, dy = y2 - y1, dd = Math.hypot(dx, dy); const sx = x1 + dx / dd * 52, sy = y1 + dy / dd * 20, ex = x2 - dx / dd * 56, ey = y2 - dy / dd * 22; g += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${l.r < 0 ? "var(--bad)" : "var(--ink)"}" stroke-width="${1 + Math.abs(l.r) * 2}" marker-end="url(#ah)"/><rect x="${(sx + ex) / 2 - 34}" y="${(sy + ey) / 2 - 9}" width="68" height="14" fill="var(--bg)"/><text class="ct" x="${(sx + ex) / 2}" y="${(sy + ey) / 2 + 2}" text-anchor="middle">${l.r > 0 ? "+" : "−"}${Math.abs(l.r).toFixed(2)} · ${l.lag}m</text>`; }); nodes.forEach(n => { const [x, y2] = pos[n]; g += `<rect x="${x - 58}" y="${y2 - 18}" width="116" height="36" fill="var(--bg)" stroke="${n.includes("Fin") ? "var(--bad)" : "var(--ink)"}"/><text class="ctb" x="${x}" y="${y2 - 2}" text-anchor="middle">${esc(n.split(" (")[0])}</text><text class="ct" x="${x}" y="${y2 + 11}" text-anchor="middle">${esc(n.split("(")[1].replace(")", ""))}</text>`; }); return C.svg(285, g, "Cause map between team metrics"); })();
    const bad = bridge.slice(1, -1).filter(x => x.value < 0).sort((a2, b2) => a2.value - b2.value);
    return {
      steps: [`${N} months × 4 functions`, `${cards.filter(c => c.ok).length} of 4 teams on target`, `Profit ${F.money(qOp[ya], "$", 1)}M → ${F.money(qOp[last], "$", 1)}M; biggest drag ${bad[0].label}`, `${links.length} strong links (|r| > 0.6)`, strong.map(l => `${l.from.split(" (")[0]} → ${l.to.split(" (")[0]}`).slice(0, 3).join("; "), `Margin model R² ${mdl.r2.toFixed(2)}; top driver discount rate`, `${bad.length} cost lines worse than a year ago`, `Profit ${F.sgn(gain, v => F.money(v, "$", 1) + "M")} per quarter after fixes`],
      kpis: [
        { label: "Falling quarters", value: String(streak), note: "In a row", tone: "bad" },
        { label: "Operating margin", value: F.pct(qm[last]), note: `${F.pp(qm[last] - qm[ya])} vs a year ago`, tone: "bad" },
        { label: "Teams on target", value: `${cards.filter(c => c.ok).length} of 4`, note: "Each judged on its own KPI", tone: "good" },
        { label: "Biggest drag", value: { Discount: "Discounts", COGS: "Product cost", Mktg: "Marketing" }[bad[0].label] || bad[0].label, note: `${F.money(bad[0].value, "$", 1)}M vs a year ago`, tone: "bad" },
        { label: "Recovery", value: F.sgn(gain, v => F.money(v, "$", 1) + "M"), note: "Per quarter with all three fixes", tone: gain > 0 ? "good" : "bad" }
      ],
      sections: [
        { title: "Every team green, profit red", note: "Quarterly operating profit ($M) against team scorecards.", chart: C.line(qs, [{ values: qOp, tone: "c3", w: 2.4 }], { fmt: v => "$" + v.toFixed(0) + "M", every: 1 }), html: T.table(["Team", "Own KPI", "Result", "Target", "Status"], cards.map(c => [c.team, c.kpi, c.fmt(c.val), c.fmt(c.target), T.pill(c.ok ? "On target" : "Missed", c.ok ? "good" : "bad")]), { right: [2, 3] }) },
        { pair: [
          { title: "Profit bridge: latest quarter vs a year ago", note: "$ millions.", chart: C.waterfall(bridge, { fmt: v => v.toFixed(0) }) },
          { title: "What explains margin", note: "Standardised weight in the margin model (monthly data). Red lowers margin.", chart: C.bar(["Discount rate", "Inventory level", "Labour % of sales", "Freight % of sales"].map((n, j) => ({ label: n, value: stdB[j], tone: stdB[j] < 0 ? "bad" : "" })), { fmt: v => v.toFixed(2), labelW: 130 }) }
        ] },
        { title: "Cause map across teams", note: "Arrows show a metric that moves first and another that follows 1 to 3 months later. Number = correlation · lag. Red arrows are negative links.", chart: net },
        { title: "Trade-offs hidden by team targets", html: T.table(["Team win", "Who pays", "How"], [["Operations kept shelves full (97%)", "Finance, Marketing", `Purchase orders ran ahead of demand, inventory rose to ${Math.max(...D.inv).toFixed(0)}M units at peak`], ["Marketing hit unit growth", "Finance", `Discounts went from ${F.pct(D.disc[N - 13], 0)} to ${F.pct(D.disc[N - 1], 0)} to clear the stock, cutting price by ${F.money(-price, "$", 1)}M a quarter`], ["HR delivered the hiring plan", "Finance", `Labour cost up ${F.money(b.labor - a.labor, "$", 1)}M a quarter while units grew ${F.pct(units[last] / units[ya] - 1)}`], ["Operations held unit cost", "Finance", `Storage and freight rose ${F.money((b.storage - a.storage) + (b.freight - a.freight), "$", 1)}M a quarter on the extra stock`]]) }
      ],
      recs: [
        { title: `Cut discounting by ${P.disc} points with a joint Marketing-Finance target`, body: "Discount rate is the largest negative weight in the margin model. Judge Marketing on gross margin per unit, not unit growth alone.", impact: "Owner: CMO + CFO", tone: "bad" },
        { title: `Clear ${P.inv}% of excess inventory and tie purchase orders to demand`, body: "Inventory leads discounts by a few months in the cause map. Add a sell-through check before Operations releases new orders.", impact: "Owner: COO", tone: "warn" },
        { title: `Slow headcount growth to ${P.hire}% a year`, body: "Labour grew faster than units. Hold back-office hiring until revenue per employee recovers.", impact: "Owner: CHRO", tone: "warn" },
        { title: "Replace team scorecards with one shared profit tree", body: "Every team hit its own number while profit fell. A monthly cross-functional review on the cause map above stops the next chain early.", impact: F.sgn(gain, v => F.money(v, "$", 1) + "M/qtr"), tone: "good" }
      ],
      context: { quarters: qs.map((x, k) => ({ quarter: x, op_profit_musd: +qOp[k].toFixed(1), margin: +qm[k].toFixed(3) })), consecutive_declines: streak, team_scorecards: cards.map(c => ({ team: c.team, kpi: c.kpi, result: c.fmt(c.val), target: c.fmt(c.target), on_target: c.ok })), profit_bridge_musd: bridge.map(x => ({ item: x.label, value: +x.value.toFixed(1) })), cross_team_links: [...strong, ...extra].map(l => ({ from: l.from, to: l.to, lag_months: l.lag, correlation: +l.r.toFixed(2) })), margin_model_r2: +mdl.r2.toFixed(2), standardized_weights: { discount_rate: +stdB[0].toFixed(2), inventory: +stdB[1].toFixed(2), labour_pct: +stdB[2].toFixed(2), freight_pct: +stdB[3].toFixed(2) }, scenario: { discount_cut_pts: P.disc, inventory_cut_pct: P.inv, hiring_growth_pct: P.hire, quarterly_profit_after: +newOp.toFixed(1), gain: +gain.toFixed(1) } }
    };
  }
};
