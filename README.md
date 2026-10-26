# VIX Pulse

A production-quality, client-side-only dashboard for exploring how stocks, ETFs, ETCs, and ADRs behaved around VIX volatility peaks. All time-series data is weekly, ends at the latest fully completed week, and ships as static JSON.

## Features

- **Dashboard**: Global ranking of all 66 assets, search, sortable metrics, weekly closes, 1-week change, and a prominent current/last-week VIX overview with regime colours.
- **Asset Detail**: Weekly dual-axis VIX/price chart with all peak markers, one label for the largest peak each year, previous/next asset navigation, and the full peak-by-peak recovery table.
- **Compare**: Select up to 10 assets. VIX is always included on a second axis, with a weekly normalised performance chart and benchmark row.
- **VIX regimes**: Low (`< 15`), Normal (`15 – < 20`), Elevated (`20 – < 30`), and High (`≥ 30`).
- **Dark/Light Mode**: Theme toggle with localStorage persistence and a no-flash initial theme.
- **Responsive**: Mobile asset cards, mobile bottom navigation, and horizontally scrollable data tables.
- **Accessible**: Keyboard-sortable columns, focus states, labelled controls, semantic tables, and reduced clutter on chart annotations.
- **Hash Routing**: Works on GitHub Pages without server rewrites.

## Tech Stack

- Vite + React 18 + TypeScript
- Tailwind CSS 4
- Apache ECharts (via `echarts-for-react`)
- React Router (HashRouter)
- Vitest
- ESLint + Prettier

## Local Development

Requires Node `^22.22.2`, `^24.15.0`, or `>=26.0.0`.

```bash
npm install
npm run dev
```

## Build and Quality Checks

```bash
npm run build
npm run test:run
npm run lint
npm run format:check
```

The chart routes are lazy-loaded so ECharts is not downloaded on the dashboard.

## Regenerate Data

The checked-in dataset uses real Yahoo Finance data through the latest completed Friday.

```bash
pip install -r scripts/requirements.txt
python scripts/fetch_data.py
```

The pipeline:

1. Downloads six years of daily `^VIX` and asset history with `yfinance`.
2. Finds VIX peak days from daily Highs above 21, with both neighbouring days lower.
3. Finds the first recovery day at or after the peak where the VIX close is below 20.
4. Calculates asset closes, percent change, days to recovery, and per-asset summaries.
5. Builds aligned Friday week-ending series for assets and VIX.
6. Captures the latest daily VIX close plus previous-day and previous-week moves.
7. Normalises London pence quotes to pounds and writes `public/data/vix-pulse.json`.

`python scripts/generate_data.py` is an offline/placeholder utility and is not used for the published dataset.

## Deployment

The app is deployed to GitHub Pages at:

<https://novapixeltech.github.io/VIX-Pulse/>

The workflow in `.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist`. GitHub Pages must use **Source: GitHub Actions**. Vite derives the production base path from `GITHUB_REPOSITORY`, so forks deploy under their own repository name.

## Project Structure

```text
src/
  components/     Layout, skeletons, VIX overview cards
  hooks/          static-data loader and theme provider
  lib/            calculations, VIX helpers, asset navigation, formatting, tests
  pages/          Dashboard, Asset Detail, Compare, About
public/data/      generated static dataset
scripts/          real-data pipeline and offline generators
```

## Data Notes

- VIX peak detection uses daily intraday Highs; recoveries and asset values use closes.
- Daily peak dates are mapped to the nearest week ending for chart annotations.
- Values remain in each security's quote currency. London-listed pence quotes are divided by 100 and labelled GBP.
- Current VIX is the latest available daily quote; weekly metrics use the latest completed Friday.
- Peak events without a VIX recovery below 20 are excluded from summary statistics and marked in the detail table.

## Disclaimer

**For research only. Not investment advice.** Past performance does not guarantee future results.
