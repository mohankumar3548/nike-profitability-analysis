# Nike Profit Detective

AI solution 13 of 14 · Business Analytics · built for **Nike**

Prepared by **K Mohan Kumar**.

**Live website:** https://mohankumar3548.github.io/nike-profitability-analysis/

## Problem statement

Company profitability has declined for three consecutive quarters, but individual departments report satisfactory performance. Develop an AI business analyst that integrates Marketing, HR, Operations and Finance data to identify cross-functional relationships responsible for the decline.

## Why Nike

Nike went through several quarters of falling profit in 2024 and 2025 while individual functions could still point to their own targets being met. This tool joins Marketing, HR, Operations and Finance data to find the cross-team chain behind the decline.

## Project structure

```
nike-profitability-analysis/
├── index.html                 Website entry point (served by GitHub Pages)
├── frontend/
│   ├── css/style.css          Layout, typography, light and dark themes
│   └── js/
│       ├── engine.js          Maths, models, charts, page layout and AI analyst panel
│       └── model.js           Sample data and the algorithm for this problem (browser version)
├── app.py                     Streamlit dashboard (Python version of the website)
├── src/
│   ├── data_generator.py      Builds the sample dataset and saves it to data/
│   ├── model.py               The algorithm in Python (pandas, NumPy, scikit-learn)
│   ├── report.py              Writes results to reports/
│   ├── utils.py               Formatting and forecasting helpers
│   └── meta.json              Problem statement, company and algorithm steps
├── data/                      Sample data as CSV
├── reports/                   Results: results.json, summary.md and CSV tables
├── tests/test_model.py        pytest tests for the data and the model
├── requirements.txt
└── pytest.ini
```

## Algorithm

1. **Integrate four functions**: Marketing, HR, Operations and Finance, monthly
2. **Department scorecards**: Each team against its own target
3. **Profit bridge**: Latest quarter vs a year ago: volume, price, cost, opex
4. **Lead-lag links**: Cross-correlations between team metrics at 0 to 3 month lags
5. **Cause map**: Keep strong, directional links as a cause chain
6. **Margin driver model**: Regression of operating margin on cross-team metrics
7. **Find the trade-offs**: Where one team's win is another team's cost
8. **Recovery plan**: Simulate coordinated fixes and explain them

The same algorithm is implemented twice: in JavaScript (`frontend/js/model.js`) so the website runs in any browser with no server, and in Python (`src/model.py`) for analysis, the Streamlit dashboard and the tests.

## How to run

**Website:** open the live link above, or open `index.html` in a browser.

**Python:**

```bash
pip install -r requirements.txt
python -m src.data_generator     # create the sample data in data/
python -m src.model              # run the algorithm and write reports/
streamlit run app.py             # open the interactive dashboard
pytest                           # run the tests
```

## Data

36 months of Marketing, HR, Operations and Finance data for one geography (sample data, $ millions). Files: `data/monthly.csv`. All figures are illustrative and are not Nike's actual numbers.

## Results (default settings, Python run)

| Measure | Value | Note |
|---|---|---|
| Quarters down vs last year | 3 | In a row, year-on-year |
| Operating margin | 6.8% | -4.3 pp vs a year ago |
| Teams on target | 4 of 4 | Each judged on its own KPI |
| Biggest drag | Discounts | -$125.8M vs a year ago |
| Recovery | +$56.2M | Per quarter with all three fixes |

### Recommended actions

1. **Cut discounting by 4 points with a joint Marketing-Finance target.** Discount rate carries the largest negative weight in the margin model. Judge Marketing on gross margin per unit, not unit growth alone.
2. **Clear 30% of excess inventory and tie purchase orders to demand.** Inventory leads discounts by a few months. Add a sell-through check before new orders.
3. **Slow headcount growth to 2% a year.** Labour grew faster than units. Hold back-office hiring until revenue per employee recovers.
4. **Replace team scorecards with one shared profit tree.** Every team hit its own number while profit fell. Review the cause links monthly as one leadership team.

Full output: [`reports/summary.md`](reports/summary.md) and [`reports/results.json`](reports/results.json).

## AI analyst panel

The website includes an "Ask the AI analyst" panel that answers questions about the results through Claude. It works when the page is opened as a Claude artifact on claude.ai. On GitHub Pages the models, charts and controls run in full and the panel shows that it is unavailable.
