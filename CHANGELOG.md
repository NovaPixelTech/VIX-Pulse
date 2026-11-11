# Changelog

## v0.4.0 - 2026-11-11

### Added

- Live VIX banner at the top of the dashboard: a large regime-coloured current VIX value with a pulsing live indicator, day change versus the previous close, an intraday 5-minute sparkline, a 10–40 level gauge with regime zones, market status, quote time in the exchange time zone, and an updated-seconds-ago counter.
- Live quote polling about once a minute through the existing Jina AI Reader relay, paused while the tab is hidden, with an immediate catch-up fetch on return; a manual refresh button is included in the banner.
- Graceful fallback to the published snapshot when the live relay is unreachable, with retry behaviour and stale-quote notes.
- Unit tests for live quote parsing, market-state derivation, and the banner's rendered states.

### Changed

- VIX regimes now carry a raw hex colour used by SVG sparkline strokes, gauge markers, and banner glows.

## v0.3.1 - 2026-10-27

### Added

- Global refresh button that bypasses browser caching and reloads the latest published market-data snapshot.
- Latest daily quote and previous-session move for each asset, visible on Dashboard, Compare, and Asset Detail.
- Weekday post-market data refresh and manual market-data workflow dispatch, with a link from the dashboard.
- Snapshot generation time and quote dates so users can see the freshness of displayed values.

### Fixed

- Browser reloads no longer reuse a cached static JSON response.
- Scheduled data updates refuse to publish snapshots containing placeholder assets.

## v0.3.0 - 2026-10-27

### Added

- Dedicated VIX Response page with a sortable sensitivity ranking, score components, profit/loss figures, and best/worst asset summaries.
- Asset Detail chart bands and directional arrows for grouped VIX recovery windows after peaks above 25.
- Per-peak VIX response metrics, including the pre-peak baseline, stress move, VIX rise, response ratio, rebound, cycle return, and recovery durations.
- 4-week and 13-week moving-average lines, values, percentage distances, and minimum/average/maximum summaries.
- Tests covering response formulas, grouped recovery cycles, weekly averages, baseline recovery timing, and ranking.

### Changed

- Mobile navigation now includes the VIX Response page.
- Methodology and documentation now describe the response-cycle and sensitivity-score calculations.

## v0.2.1 - 2026-10-26

### Added

- Previous/next asset controls on Asset Detail for moving through the ranked list without returning to the dashboard.
- Position indicator, disabled endpoint states, and accessible button labels with the adjacent ticker and name.
- Focus management and automatic scroll-to-top when switching assets.
- Unit tests for ranked, stale, duplicate, and direct-link navigation order.

### Changed

- Asset Detail charts now replace the previous chart state cleanly when switching assets.
- Direct asset links use a stable ticker order until a ranked navigation order is available.

### Fixed

- CI tests now run on Node 24 because `jsdom` 30 and `undici` 8 require native zstd support.

## v0.2.0 - 2026-10-26

### Added

- Weekly asset and VIX series aligned on a shared Friday week-ending axis.
- Prominent current VIX and latest closed-week VIX cards with absolute and percentage moves versus the previous day/week.
- Colour-coded VIX regimes: Low `< 15`, Normal `15 – < 20`, Elevated `20 – < 30`, High `≥ 30`.
- VIX benchmark strip and always-on VIX series on the Compare page.
- Weekly close and 1-week change columns on the dashboard and comparison table.
- Mobile bottom navigation.
- Accessible sortable ranking columns and keyboard-operable rows.
- Six-year lookback with 66 real Yahoo Finance assets and zero placeholders.
- GBP/pence normalisation for London-listed instruments.
- Tests for VIX regime boundaries, weekly statistics, and date alignment.
- ESLint and Prettier configuration.

### Changed

- Compare selection increased from 5 to 10 assets, with NVDA/AAPL/MSFT as the default selection.
- Asset Detail chart now uses weekly axes, maps daily peaks to nearest week endings, and labels the largest peak per year while retaining all peak markers.
- Peak table is scrollable, sticky-headed, and newest-first.
- Chart styling follows the active light/dark theme.
- Static data loading respects Vite's configured base path.
- Chart-heavy routes are lazy-loaded to keep initial dashboard JavaScript smaller.
- React pinned to 18.3.1.
- Deployment documentation now includes the live GitHub Pages URL.

### Fixed

- Missing page title and favicon metadata.
- Stale generated Vite build artifacts tracked in Git.
- Legacy Node `__dirname` usage in Vite/Vitest configuration.
- Light-theme contrast for VIX regime and movement colours.
- Search empty state and clear-search affordance.

## v0.1.0 MVP - 2026-10-25

### Added

- Initial release of VIX Pulse
- Dashboard with global ranking and KPI metrics
- Asset detail pages with dual-axis VIX/price charts
- Compare functionality for up to 5 assets
- About page with methodology
- Dark/light theme support
- Responsive design
- Hash routing for GitHub Pages compatibility
- Static data with 66 tracked assets
- Python script to regenerate data from yfinance
- GitHub Actions deployment workflow
- Vitest test setup
