# VIX Pulse

A client-side dashboard for exploring how stocks, ETFs, ETCs, and ADRs behaved around VIX volatility peaks. Daily event-analysis series and weekly long-range series ship as static JSON.

## Features

- **Dashboard**: Global ranking of all 66 assets, search, sortable metrics, latest available daily asset quotes, weekly closes, and a prominent current/last-week VIX overview.
- **Asset Detail**: Latest asset quote and daily move plus an aligned daily VIX/price chart when available, grouped green/red VIX recovery periods, rebound arrows, moving averages, and per-peak response metrics.
- **VIX Response**: Searchable, sortable ranking for individual daily VIX local highs above 21. The default order is by signed mean peak-to-recovery return; separate average-move and daily VIX co-movement metrics are shown.
- **Compare**: Select up to 10 assets. VIX is always included on a second axis, with a weekly normalised performance chart and benchmark row.
- **VIX regimes**: Low (`< 15`), Normal (`15 – < 20`), Elevated (`20 – < 30`), and High (`≥ 30`).
- **Local custom assets**: Import dated daily closes from a CSV, add the asset to the same VIX analysis, and keep it in this browser's local storage. Custom assets can be removed from the dashboard.
- **Dark/Light Mode**: Theme toggle with localStorage persistence and a no-flash initial theme.
- **Responsive**: Mobile asset cards, mobile bottom navigation, and horizontally scrollable data tables.
- **Refresh**: Cache-busting refresh button reloads the latest published snapshot on every page. GitHub Actions fetches and publishes market data after weekday market close; a link on the dashboard can start a new download manually.
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
2. Finds VIX peak days from daily Highs strictly above 21, with both neighbouring trading-day highs lower.
3. Finds the first recovery day at or after the peak where the VIX close is below 20.
4. Calculates asset closes, percent change, days to recovery, and per-asset summaries.
5. Builds aligned Friday week-ending series for assets and VIX.
6. Captures the latest daily VIX close plus previous-day and previous-week moves.
7. Captures the latest available daily asset close and previous-session move for all tracked assets.
8. Aligns daily adjusted asset closes to the VIX trading calendar, normalises London pence quotes to pounds, and writes `public/data/vix-pulse.json`.

`python scripts/generate_data.py` is an offline/placeholder utility and is not used for the published dataset.

## Deployment

The app is deployed to GitHub Pages at:

<https://novapixeltech.github.io/VIX-Pulse/>

The workflow in `.github/workflows/deploy.yml` builds on every push to `main`, refreshes market data on weekdays after the US close, and publishes `dist`. A manual workflow run can request a fresh data download; it takes a few minutes and requires GitHub Actions access. The in-app refresh button bypasses browser caching and reloads the newest published snapshot; GitHub Pages cannot fetch Yahoo data directly from browser code. GitHub Pages must use **Source: GitHub Actions**. Vite derives the production base path from `GITHUB_REPOSITORY`, so forks deploy under their own repository name.

## Project Structure

```text
src/
  components/     Layout, skeletons, VIX overview, response metrics
  hooks/          static-data loader and theme provider
  lib/            calculations, VIX response analytics, navigation, formatting, tests
  pages/          Dashboard, Asset Detail, Compare, VIX Response, About
public/data/      generated static dataset
scripts/          real-data pipeline and offline generators
```

## Data Notes

- VIX peak detection uses daily intraday Highs; recoveries and asset values use closes.
- Asset Detail plots daily event markers on their exact dates; Compare and long-range charts retain weekly data.
- The supplied report's local-high rule is used: daily VIX High strictly above 21, higher than both adjacent trading-day Highs; recovery is the first daily VIX Close below 20 on or after the peak date. For an asset holiday, its latest close on or before the VIX observation is used (never a future price).
- Asset Detail charts and tables use the same individual daily events and the same selectable date window. Grouped recovery cycles are used only for chart shading; summary averages use every qualifying individual peak.
- The default report window reproduces the supplied script's yfinance range (start 2025-09-01, exclusive end 2026-09-15; thus observations through 2026-09-14). Users can change or clear the date bounds. Price series are Yahoo Finance auto-adjusted closes, which may differ from Digrin or other providers.
- The VIX Response table defaults to descending signed average peak-to-recovery return, matching the supplied comparison. A separate 0–100 magnitude score ranks average absolute price movement; it is not a performance score or causal measure of VIX sensitivity.
- Custom asset CSV imports align dated closes to the shared VIX calendar and use the same event calculations. Provide a ticker, name, or ISIN plus a CSV with `Date` and `Adj Close`/`Close` columns. The static GitHub Pages app cannot resolve identifiers, download arbitrary histories, or write to a shared database; custom assets persist only in the current browser profile.
- Daily VIX co-movement is Pearson correlation between asset close-to-close percentage returns and VIX close point changes; a regression slope (% asset return per VIX point) is also shown. Only adjacent common sessions with real asset closes are used. Forward-filled holidays are excluded. These estimates are descriptive, not causal.
- Current VIX and asset quote cards use the latest quote included in the generated snapshot and display its date. Weekly chart history remains aligned to completed Friday closes.
- Baselines, moving averages, and time to regain baseline are weekly-close estimates; peak-to-recovery returns use daily closes.
- 4-week and 13-week moving averages, and time to regain the baseline, are calculated from weekly closes; those timings are weekly estimates rather than daily asset observations.
- Values remain in each security's quote currency. London-listed pence quotes are divided by 100 and labelled GBP.
- Current VIX is the latest available daily quote; weekly metrics use the latest completed Friday.
- The legacy peak-recovery summary excludes peaks without a VIX recovery below 20. The VIX Response page retains an unresolved stress cycle as pending, includes available peak measurements, and leaves it unshaded until recovery metrics exist.

## Disclaimer

**For research only. Not investment advice.** Past performance does not guarantee future results.
