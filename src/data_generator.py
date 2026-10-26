"""Sample data for Nike: 36 months of Marketing, HR, Operations and Finance data for one geography ($ millions)."""
from pathlib import Path

import numpy as np
import pandas as pd


def generate(seed: int = 42) -> dict:
    rng = np.random.default_rng(seed)
    N = 36; t = np.arange(N)
    over = np.where(t >= 20, 0.07 * np.minimum(1, (t - 20) / 10), 0)      # Operations starts over-ordering in month 21
    ordered = (10 + 0.05 * t) * (1 + over) + rng.normal(0, 0.2, N)
    inv, disc, units = [], [], []
    I = 22.0
    for i in range(N):
        d = float(np.clip(0.12 + 0.014 * max(0, I - 23) + rng.normal(0, 0.005), 0.08, 0.32))
        u = (10 + 0.05 * i) * (1 + 1.4 * (d - 0.12)) * (1 + 0.025 * np.sin(2 * np.pi * i / 12)) + rng.normal(0, 0.15)
        I = max(10, I + ordered[i] - u); inv.append(I); disc.append(d); units.append(u)
    inv, disc, units = map(np.array, (inv, disc, units))
    revenue = units * 78 * (1 - disc)
    cogs_unit = 33 + 0.05 * t + rng.normal(0, 0.4, N)
    freight = units * (3.2 + 0.08 * np.maximum(0, inv - 24)) + rng.normal(0, 0.8, N)
    storage = inv * 1.9 + rng.normal(0, 0.6, N)
    marketing = 95 + 0.6 * t + rng.normal(0, 3, N)
    headcount = 2400 * (1 + 0.075 * t / 12) + rng.normal(0, 10, N)
    labour = headcount * 0.0105 * (1 + rng.normal(0, 0.01, N))
    other = 85 + rng.normal(0, 4, N)
    df = pd.DataFrame({"month": pd.period_range("2023-06", periods=N, freq="M").astype(str),
                       "ops_purchase_orders_m_units": ordered.round(3), "ops_inventory_m_units": inv.round(3), "ops_freight_cost": freight.round(2), "ops_storage_cost": storage.round(2),
                       "mkt_discount_rate": disc.round(4), "mkt_unit_sales_m": units.round(3), "mkt_spend": marketing.round(2),
                       "hr_headcount": headcount.round(0), "hr_labour_cost": labour.round(2),
                       "fin_revenue": revenue.round(2), "fin_cogs_per_unit": cogs_unit.round(3), "fin_other_opex": other.round(2)})
    df["fin_operating_profit"] = (df.fin_revenue - df.mkt_unit_sales_m * df.fin_cogs_per_unit - df.ops_freight_cost - df.ops_storage_cost - df.mkt_spend - df.hr_labour_cost - df.fin_other_opex).round(2)
    return {"monthly": df}


# ---------------------------------------------------------------------------
# Save and load helpers
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def save(data: dict, folder: Path = DATA_DIR) -> None:
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    for name, df in data.items():
        df.to_csv(folder / f"{name}.csv", index=False)


def load_or_generate(folder: Path = DATA_DIR, seed: int = 42) -> dict:
    """Read the CSVs in data/ if they exist, otherwise generate fresh sample data."""
    folder = Path(folder)
    names = list(generate(seed).keys())
    if all((folder / f"{n}.csv").exists() for n in names):
        return {n: pd.read_csv(folder / f"{n}.csv") for n in names}
    return generate(seed)


if __name__ == "__main__":
    d = generate(42)
    save(d)
    for n, df in d.items():
        print(f"data/{n}.csv  {len(df):,} rows x {df.shape[1]} columns")
