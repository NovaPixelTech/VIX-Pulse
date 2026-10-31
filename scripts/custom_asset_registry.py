"""Validation and storage for Yahoo assets added through workflow_dispatch."""
from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

REGISTRY_PATH = Path(__file__).resolve().parent / "custom_assets.json"
ASSET_TYPES = {"stock", "etf", "etc", "adr", "index"}
YAHOO_SYMBOL_PATTERN = re.compile(r"^[A-Za-z0-9.^=_-]{1,40}$")


def normalize_asset_entry(raw: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("Each custom asset entry must be a JSON object.")
    yahoo_ticker = str(raw.get("yahooTicker", "")).strip()
    if not YAHOO_SYMBOL_PATTERN.fullmatch(yahoo_ticker) or yahoo_ticker.upper() == "^VIX":
        raise ValueError("Enter a valid Yahoo Finance symbol (for example AAPL, RHM.DE, or ES=F).")

    ticker = str(raw.get("ticker") or yahoo_ticker).strip().upper()
    if not YAHOO_SYMBOL_PATTERN.fullmatch(ticker):
        raise ValueError(
            "The display ticker may contain only letters, numbers, dots, dashes, underscores, ^, or =."
        )

    asset_type = str(raw.get("type") or "stock").strip().lower()
    if asset_type not in ASSET_TYPES:
        raise ValueError(f"Unsupported asset type: {asset_type}")

    currency = str(raw.get("currency") or "USD").strip().upper()
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise ValueError("Currency must be a three-letter code such as USD, EUR, or GBP.")

    name = str(raw.get("name") or "").strip() or ticker
    exchange = str(raw.get("exchange") or "").strip() or "Yahoo Finance"
    if len(name) > 120 or len(exchange) > 80:
        raise ValueError("Name must be 120 characters or fewer and exchange 80 characters or fewer.")

    supplied_isin = str(raw.get("isin") or "").strip().upper()
    generated_id = re.sub(r"[^A-Z0-9.-]", "-", ticker)
    isin = supplied_isin or f"CUSTOM-{generated_id}"
    if len(isin) > 32:
        raise ValueError("ISIN/custom identifier must be 32 characters or fewer.")

    try:
        price_divisor = float(raw.get("priceDivisor", 1))
    except (TypeError, ValueError) as exc:
        raise ValueError("Price divisor must be a positive number.") from exc
    if not math.isfinite(price_divisor) or price_divisor <= 0:
        raise ValueError("Price divisor must be a positive number.")

    return {
        "isin": isin,
        "ticker": ticker,
        "name": name,
        "type": asset_type,
        "currency": currency,
        "exchange": exchange,
        "yahooTicker": yahoo_ticker,
        "priceDivisor": price_divisor,
    }


def load_custom_assets(path: Path = REGISTRY_PATH) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as handle:
        raw_assets = json.load(handle)
    if not isinstance(raw_assets, list):
        raise ValueError(f"{path} must contain a JSON array.")
    return [normalize_asset_entry(asset) for asset in raw_assets]


def _assert_unique(
    assets: list[dict[str, Any]],
) -> None:
    for field, label in (
        ("isin", "ISIN/custom identifier"),
        ("ticker", "display ticker"),
        ("yahooTicker", "Yahoo ticker"),
    ):
        seen: set[str] = set()
        for asset in assets:
            value = asset[field].upper()
            if value in seen:
                raise ValueError(f"Duplicate {label}: {value}")
            seen.add(value)


def add_or_update_custom_asset(
    raw: dict[str, Any],
    *,
    builtin_assets: list[tuple[str, str, str, str, str, str, str]],
    path: Path = REGISTRY_PATH,
) -> list[dict[str, Any]]:
    asset = normalize_asset_entry(raw)
    custom_assets = load_custom_assets(path)

    for isin, ticker, _name, _asset_type, _currency, _exchange, yahoo_ticker in builtin_assets:
        if (
            asset["isin"].upper() == isin.upper()
            or asset["ticker"].upper() == ticker.upper()
            or asset["yahooTicker"].upper() == yahoo_ticker.upper()
        ):
            raise ValueError(f"{asset['yahooTicker']} is already included in the built-in asset catalog.")

    matching_index = next(
        (
            index
            for index, current in enumerate(custom_assets)
            if current["yahooTicker"].upper() == asset["yahooTicker"].upper()
        ),
        None,
    )
    next_assets = list(custom_assets)
    if matching_index is None:
        next_assets.append(asset)
    else:
        next_assets[matching_index] = asset
    _assert_unique(next_assets)

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(f"{path.suffix}.tmp")
    with temporary_path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(next_assets, handle, indent=2, ensure_ascii=False, allow_nan=False)
        handle.write("\n")
    temporary_path.replace(path)
    return next_assets
