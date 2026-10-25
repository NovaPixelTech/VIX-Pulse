# VIX Pulse

A production-quality, client-side-only web app that visualizes the relationship between VIX volatility peaks and the subsequent performance of stocks, ETFs, and ETCs.

## Features

- **Dashboard**: Global ranking of all tracked assets with search functionality
- **Asset Detail**: Dual-axis chart showing VIX and asset price with peak annotations
- **Compare**: Multi-select up to 5 assets with normalized performance comparison
- **Dark/Light Mode**: Theme toggle with localStorage persistence
- **Responsive**: Fully mobile-responsive design
- **Hash Routing**: Works seamlessly on GitHub Pages

## Tech Stack

- Vite + React 18 + TypeScript
- Tailwind CSS
- Apache ECharts (via echarts-for-react)
- React Router (HashRouter)
- Vitest for testing

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Regenerate Data

```bash
pip install -r requirements.txt
python scripts/fetch_data.py
```

Or use the included generator for placeholder data:
```bash
python scripts/generate_data.py
```

## Deployment

1. Create a GitHub repository
2. Enable GitHub Pages in repository settings (Source: GitHub Actions)
3. Push to main branch - the workflow will automatically build and deploy

The app is configured with `base: '/<REPO_NAME>/'` for GitHub Pages subpath deployment.

## Disclaimer

**For research only. Not investment advice.**
