from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from custom_asset_registry import add_or_update_custom_asset, load_custom_assets


BUILTIN_ASSETS = [
    ("US0378331005", "AAPL", "Apple Inc", "stock", "USD", "NASDAQ", "AAPL"),
]


def new_asset(**updates: str) -> dict[str, str]:
    asset = {
        "yahooTicker": "RHM.DE",
        "ticker": "RHM",
        "name": "Rheinmetall AG",
        "isin": "DE0007030009",
        "type": "stock",
        "currency": "EUR",
        "exchange": "XETRA",
        "priceDivisor": "1",
    }
    asset.update(updates)
    return asset


class CustomAssetRegistryTests(unittest.TestCase):
    def test_adds_and_updates_custom_assets_by_yahoo_ticker(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "custom_assets.json"
            added = add_or_update_custom_asset(new_asset(), builtin_assets=BUILTIN_ASSETS, path=path)
            self.assertEqual(len(added), 1)
            self.assertEqual(added[0]["yahooTicker"], "RHM.DE")
            self.assertEqual(added[0]["priceDivisor"], 1.0)

            updated = add_or_update_custom_asset(
                new_asset(name="Updated name"), builtin_assets=BUILTIN_ASSETS, path=path
            )
            self.assertEqual(len(updated), 1)
            self.assertEqual(updated[0]["name"], "Updated name")
            self.assertEqual(load_custom_assets(path), updated)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), updated)

    def test_generates_a_local_identifier_when_isin_is_omitted(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "custom_assets.json"
            added = add_or_update_custom_asset(
                new_asset(isin=""), builtin_assets=BUILTIN_ASSETS, path=path
            )
            self.assertEqual(added[0]["isin"], "CUSTOM-RHM")

    def test_rejects_invalid_symbols_and_built_in_duplicates(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "custom_assets.json"
            with self.assertRaisesRegex(ValueError, "valid Yahoo Finance symbol"):
                add_or_update_custom_asset(
                    new_asset(yahooTicker="bad symbol"), builtin_assets=BUILTIN_ASSETS, path=path
                )
            with self.assertRaisesRegex(ValueError, "already included"):
                add_or_update_custom_asset(
                    new_asset(yahooTicker="AAPL", ticker="AAPL"),
                    builtin_assets=BUILTIN_ASSETS,
                    path=path,
                )
            self.assertFalse(path.exists())

    def test_rejects_invalid_currency_or_price_divisor(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "custom_assets.json"
            with self.assertRaisesRegex(ValueError, "three-letter code"):
                add_or_update_custom_asset(
                    new_asset(currency="EURO"), builtin_assets=BUILTIN_ASSETS, path=path
                )
            with self.assertRaisesRegex(ValueError, "positive number"):
                add_or_update_custom_asset(
                    new_asset(priceDivisor="0"), builtin_assets=BUILTIN_ASSETS, path=path
                )
            self.assertFalse(path.exists())


if __name__ == "__main__":
    unittest.main()
