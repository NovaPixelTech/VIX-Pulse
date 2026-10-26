# Changelog

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
