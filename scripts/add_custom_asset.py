#!/usr/bin/env python3
"""Add or update one Yahoo symbol in the repository's published asset catalog."""
from __future__ import annotations

import os

from custom_asset_registry import add_or_update_custom_asset
from fetch_data import ASSETS


def main() -> None:
    yahoo_ticker = os.environ.get("ASSET_YAHOO_TICKER", "").strip()
    if not yahoo_ticker:
        raise SystemExit("ASSET_YAHOO_TICKER is required when adding a custom asset.")

    asset = {
        "yahooTicker": yahoo_ticker,
        "ticker": os.environ.get("ASSET_DISPLAY_TICKER", "").strip() or yahoo_ticker,
        "name": os.environ.get("ASSET_NAME", "").strip() or yahoo_ticker,
        "isin": os.environ.get("ASSET_ISIN", "").strip(),
        "type": os.environ.get("ASSET_TYPE", "stock").strip(),
        "currency": os.environ.get("ASSET_CURRENCY", "USD").strip(),
        "exchange": os.environ.get("ASSET_EXCHANGE", "Yahoo Finance").strip(),
        "priceDivisor": os.environ.get("ASSET_PRICE_DIVISOR", "1").strip(),
    }

    try:
        assets = add_or_update_custom_asset(asset, builtin_assets=ASSETS)
    except (ValueError, OSError) as exc:
        raise SystemExit(str(exc)) from exc
    print(f"Registered {asset['yahooTicker']} in the published catalog ({len(assets)} custom assets).")


if __name__ == "__main__":
    main()
