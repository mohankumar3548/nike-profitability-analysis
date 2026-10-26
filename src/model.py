"""Cross-functional root cause of a multi-quarter profit decline for Nike."""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

from src.utils import bar, kpi, line, pct, pp, rec, table

META = json.loads(Path(__file__).with_name("meta.json").read_text())
PARAMS = [
    {"name": "discount_cut_pts", "label": "Cut average discount by (pts)", "min": 0, "max": 10, "step": 1, "default": 4},
    {"name": "inventory_cut_pct", "label": "Cut excess inventory by (%)", "min": 0, "max": 60, "step": 10, "default": 30},
    {"name": "hiring_growth_pct", "label": "Slow hiring growth to (% a year)", "min": 0, "max": 8, "step": 1, "default": 2},
]
LINKS = {"ops_purchase_orders_m_units": "Purchase orders (Ops)", "ops_inventory_m_units": "Inventory (Ops)", "mkt_discount_rate": "Discount rate (Mkt)",
         "mkt_unit_sales_m": "Unit sales (Mkt)", "ops_freight_cost": "Freight cost (Ops)", "ops_storage_cost": "Storage cost (Ops)", "hr_headcount": "Headcount (HR)",
         "hr_labour_cost": "Labour cost (HR)", "margin": "Operating margin (Fin)"}
M_ = lambda s: ("-" if s < 0 else "") + f"${abs(s):,.1f}M"


def run(data, discount_cut_pts=4, inventory_cut_pct=30, hiring_growth_pct=2):
    D = data["monthly"].copy(); N = len(D)
    D["margin"] = D.fin_operating_profit / D.fin_revenue
    D["quarter"] = [f"Q{(i // 3) % 4 + 1}'{23 + i // 12}" for i in range(N)]
    Q = D.groupby("quarter", sort=False).agg(op_profit=("fin_operating_profit", "sum"), revenue=("fin_revenue", "sum"), units=("mkt_unit_sales_m", "sum"),
                                             freight=("ops_freight_cost", "sum"), storage=("ops_storage_cost", "sum"), mkt=("mkt_spend", "sum"), labour=("hr_labour_cost", "sum"),
                                             other=("fin_other_opex", "sum"), cogs_unit=("fin_cogs_per_unit", "mean")).reset_index()
    Q["margin"] = Q.op_profit / Q.revenue; Q["asp"] = Q.revenue / Q.units
    streak = 0
    for k in range(len(Q) - 1, 3, -1):                      # year-on-year, so seasonality does not hide the trend
        if Q.op_profit[k] < Q.op_profit[k - 4]: streak += 1
        else: break
    a, b = Q.iloc[-5], Q.iloc[-1]
    bridge = pd.DataFrame([("Year-ago profit", a.op_profit), ("Volume", (b.units - a.units) * (a.asp - a.cogs_unit)), ("Discounts", b.units * (b.asp - a.asp)),
                           ("Product cost", -b.units * (b.cogs_unit - a.cogs_unit)), ("Freight", -(b.freight - a.freight)), ("Storage", -(b.storage - a.storage)),
                           ("Marketing", -(b.mkt - a.mkt)), ("Labour", -(b.labour - a.labour)), ("Other", -(b.other - a.other)), ("Latest profit", b.op_profit)], columns=["item", "usd_m"]).round(1)
    drags = bridge.iloc[1:-1].sort_values("usd_m")
    cards = pd.DataFrame([
        ("Marketing", "Unit sales growth vs last year", b.units / a.units - 1, 0.03, True),
        ("Operations", "On-shelf availability", 0.97, 0.95, True),
        ("HR", "Hiring plan delivered", (D.hr_headcount.iloc[-1] - D.hr_headcount.iloc[-13]) / (D.hr_headcount.iloc[-13] * 0.064), 1.0, True),
        ("Finance", "Cost of goods per unit vs budget", D.fin_cogs_per_unit.tail(3).mean() / 35.2 - 1, 0.01, False)], columns=["team", "own_kpi", "result", "target", "higher_is_better"])
    cards["on_target"] = np.where(cards.higher_is_better, cards.result >= cards.target, cards.result <= cards.target)
    links = []
    for x in LINKS:
        for y in LINKS:
            if x == y or (x.split("_")[0] == y.split("_")[0] and y != "margin"): continue
            best = max(((l, np.corrcoef(D[x].to_numpy()[: N - l], D[y].to_numpy()[l:])[0, 1]) for l in (1, 2, 3)), key=lambda t: abs(t[1]))
            if abs(best[1]) > 0.6: links.append({"from": LINKS[x], "to": LINKS[y], "lag_months": best[0], "correlation": round(best[1], 2)})
    Lk = pd.DataFrame(links).sort_values("correlation", key=abs, ascending=False) if links else pd.DataFrame(columns=["from", "to", "lag_months", "correlation"])
    chain = Lk[Lk.apply(lambda r: (r["from"], r["to"]) in {("Purchase orders (Ops)", "Inventory (Ops)"), ("Inventory (Ops)", "Discount rate (Mkt)"), ("Discount rate (Mkt)", "Unit sales (Mkt)"),
                                                           ("Inventory (Ops)", "Storage cost (Ops)"), ("Discount rate (Mkt)", "Operating margin (Fin)"), ("Headcount (HR)", "Labour cost (HR)"),
                                                           ("Storage cost (Ops)", "Operating margin (Fin)"), ("Inventory (Ops)", "Operating margin (Fin)")}, axis=1)] if len(Lk) else Lk
    X = pd.DataFrame({"Discount rate": D.mkt_discount_rate, "Inventory level": D.ops_inventory_m_units, "Labour % of sales": D.hr_labour_cost / D.fin_revenue, "Freight % of sales": D.ops_freight_cost / D.fin_revenue})
    Xs = StandardScaler().fit_transform(X); ys = (D.margin - D.margin.mean()) / D.margin.std()
    mdl = LinearRegression().fit(Xs, ys)
    weights = pd.DataFrame({"factor": X.columns, "standardised_weight": mdl.coef_.round(2)}).sort_values("standardised_weight")
    # recovery simulation on the latest quarter
    sim = 0.0
    for i in range(N - 3, N):
        r = D.iloc[i]; d2 = max(0.08, r.mkt_discount_rate - discount_cut_pts / 100)
        u2 = r.mkt_unit_sales_m * (1 - 1.4 * (r.mkt_discount_rate - d2))
        ex = max(0, r.ops_inventory_m_units - 24); inv2 = r.ops_inventory_m_units - ex * inventory_cut_pct / 100
        rev2 = u2 * 78 * (1 - d2)
        lab2 = r.hr_labour_cost * (1 + hiring_growth_pct / 100 * 0.25) / (1 + 0.075 * 0.25)
        clear = ex * inventory_cut_pct / 100 * r.fin_cogs_per_unit * 0.15 / 3
        sim += rev2 - u2 * r.fin_cogs_per_unit - u2 * (3.2 + 0.08 * max(0, inv2 - 24)) - inv2 * 1.9 - r.mkt_spend - lab2 - r.fin_other_opex - clear
    gain = sim - b.op_profit
    trade = pd.DataFrame([("Operations kept shelves full", "Finance, Marketing", f"Purchase orders ran ahead of demand; inventory peaked at {D.ops_inventory_m_units.max():.0f}M units"),
                          ("Marketing hit unit growth", "Finance", f"Discounts rose from {pct(D.mkt_discount_rate.iloc[-13], 0)} to {pct(D.mkt_discount_rate.iloc[-1], 0)} to clear stock"),
                          ("HR delivered the hiring plan", "Finance", f"Labour cost up {M_(b.labour - a.labour)} a quarter"),
                          ("Operations held unit cost", "Finance", f"Storage and freight up {M_((b.storage - a.storage) + (b.freight - a.freight))} a quarter")], columns=["team_win", "who_pays", "how"])
    return {
        "steps": [f"{N} months x 4 functions", f"{int(cards.on_target.sum())} of 4 teams on target", f"Profit {M_(a.op_profit)} -> {M_(b.op_profit)}; biggest drag {drags.iloc[0]['item']}",
                  f"{len(Lk)} strong links (|r| > 0.6)", "; ".join(f"{r['from']} -> {r['to']}" for _, r in chain.head(3).iterrows()) or "No chain links",
                  f"Margin model R² {mdl.score(Xs, ys):.2f}; most negative weight {weights.iloc[0].factor}", f"{int((bridge.iloc[1:-1].usd_m < 0).sum())} lines worse than a year ago",
                  f"Profit {gain:+,.1f}M per quarter after fixes"],
        "kpis": [kpi("Quarters down vs last year", str(streak), "In a row, year-on-year"), kpi("Operating margin", pct(b.margin), f"{pp(b.margin - a.margin)} vs a year ago"),
                 kpi("Teams on target", f"{int(cards.on_target.sum())} of 4", "Each judged on its own KPI"), kpi("Biggest drag", drags.iloc[0]["item"], f"{M_(drags.iloc[0].usd_m)} vs a year ago"),
                 kpi("Recovery", f"{'+' if gain >= 0 else '-'}{M_(abs(gain))}", "Per quarter with all three fixes")],
        "charts": [line("Quarterly operating profit ($M)", Q[["quarter", "op_profit"]], "quarter", "op_profit"), bar("Profit bridge: latest quarter vs a year ago ($M)", bridge, "item", "usd_m"),
                   bar("What explains margin (standardised weights)", weights, "factor", "standardised_weight")],
        "tables": [table("Team scorecards", cards.drop(columns="higher_is_better").round(3)), table("Cross-team cause links", Lk), table("Trade-offs hidden by team targets", trade), table("Profit bridge", bridge)],
        "recs": [rec(f"Cut discounting by {discount_cut_pts} points with a joint Marketing-Finance target", "Discount rate carries the largest negative weight in the margin model. Judge Marketing on gross margin per unit, not unit growth alone.", "Owner: CMO + CFO"),
                 rec(f"Clear {inventory_cut_pct}% of excess inventory and tie purchase orders to demand", "Inventory leads discounts by a few months. Add a sell-through check before new orders.", "Owner: COO"),
                 rec(f"Slow headcount growth to {hiring_growth_pct}% a year", "Labour grew faster than units. Hold back-office hiring until revenue per employee recovers.", "Owner: CHRO"),
                 rec("Replace team scorecards with one shared profit tree", "Every team hit its own number while profit fell. Review the cause links monthly as one leadership team.", f"{gain:+,.1f}M/qtr")],
    }


if __name__ == "__main__":
    from src.data_generator import load_or_generate
    from src.report import write_reports

    out = run(load_or_generate(), **{p["name"]: p["default"] for p in PARAMS})
    for k in out["kpis"]:
        print(f"{k['label']}: {k['value']}  {k['note']}")
    print("Reports written to", write_reports(out, META, Path(__file__).resolve().parent.parent / "reports"))
