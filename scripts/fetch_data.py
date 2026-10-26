#!/usr/bin/env python3
"""
VIX Pulse data pipeline.

Downloads daily and weekly market data with yfinance, applies the VIX
peak -> normalization methodology, and writes public/data/vix-pulse.json.

Run:
    pip install -r scripts/requirements.txt
    python scripts/fetch_data.py
"""
from __future__ import annotations

import json
import random
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

try:
    import numpy as np
    import pandas as pd
    import yfinance as yf
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Please install requirements: pip install -r scripts/requirements.txt") from exc

VIX_THRESHOLD_PEAK = 21.0
VIX_THRESHOLD_RECOVERY = 20.0
LOOKBACK_YEARS = 6
OUTPUT = Path(__file__).resolve().parent.parent / "public" / "data" / "vix-pulse.json"

# ISIN, display ticker, name, type, currency, exchange, Yahoo Finance ticker
ASSETS: list[tuple[str, str, str, str, str, str, str]] = [
    ("US5951121038", "MU", "Micron Technology Inc", "stock", "USD", "NASDAQ", "MU"),
    ("US67066G1040", "NVDA", "NVIDIA Corporation", "stock", "USD", "NASDAQ", "NVDA"),
    ("US88160R1014", "TSLA", "Tesla Inc", "stock", "USD", "NASDAQ", "TSLA"),
    ("US0378331005", "AAPL", "Apple Inc", "stock", "USD", "NASDAQ", "AAPL"),
    ("US5949181045", "MSFT", "Microsoft Corporation", "stock", "USD", "NASDAQ", "MSFT"),
    ("US46625H1005", "JPM", "JPMorgan Chase & Co", "stock", "USD", "NYSE", "JPM"),
    ("US0605051046", "BAC", "Bank of America Corp", "stock", "USD", "NYSE", "BAC"),
    ("US9311421039", "WMT", "Walmart Inc", "stock", "USD", "NYSE", "WMT"),
    ("US92826C8394", "V", "Visa Inc", "stock", "USD", "NYSE", "V"),
    ("US4592001014", "IBM", "International Business Machines", "stock", "USD", "NYSE", "IBM"),
    ("US0028241000", "ABT", "Abbott Laboratories", "stock", "USD", "NYSE", "ABT"),
    ("US68389X1054", "ORCL", "Oracle Corporation", "stock", "USD", "NYSE", "ORCL"),
    ("US4370761029", "HD", "Home Depot Inc", "stock", "USD", "NYSE", "HD"),
    ("US6516391066", "NEM", "Newmont Corporation", "stock", "USD", "NYSE", "NEM"),
    ("CA0084741085", "AEM", "Agnico Eagle Mines Ltd", "stock", "USD", "NYSE", "AEM"),
    ("CA13321L1085", "CCJ", "Cameco Corporation", "stock", "USD", "NYSE", "CCJ"),
    ("CA2926717083", "UUUU", "Energy Fuels Inc", "stock", "USD", "NYSE American", "UUUU"),
    ("DE000HAG0005", "HAG", "Hensoldt AG", "stock", "EUR", "XETRA", "HAG.DE"),
    ("DE0007030009", "RHM", "Rheinmetall AG", "stock", "EUR", "XETRA", "RHM.DE"),
    ("US21037T1097", "CEG", "Constellation Energy Corp", "stock", "USD", "NASDAQ", "CEG"),
    ("US3453708600", "F", "Ford Motor Company", "stock", "USD", "NYSE", "F"),
    ("US40051E2028", "ASR", "Grupo Aeroportuario del Sureste ADR", "adr", "USD", "NYSE", "ASR"),
    ("US4622221004", "IONS", "Ionis Pharmaceuticals Inc", "stock", "USD", "NASDAQ", "IONS"),
    ("US65336K1034", "NXST", "Nexstar Media Group Inc", "stock", "USD", "NASDAQ", "NXST"),
    ("US2296631094", "CUBE", "CubeSmart", "stock", "USD", "NYSE", "CUBE"),
    ("US8334451098", "SNOW", "Snowflake Inc", "stock", "USD", "NYSE", "SNOW"),
    ("LU1778762911", "SPOT", "Spotify Technology SA", "stock", "USD", "NYSE", "SPOT"),
    ("LU1861132840", "RBOT", "Amundi MSCI Robotics & AI ESG UCITS ETF", "etf", "USD", "LSE", "RBOT.L"),
    ("LU1900066033", "LSMC", "Amundi MSCI Semiconductors ESG UCITS ETF", "etf", "EUR", "XETRA", "LSMC.DE"),
    ("LU1900066975", "KRW", "Amundi MSCI Korea UCITS ETF", "etf", "USD", "LSE", "KRW.L"),
    ("LU1589349734", "MIVU", "Amundi MSCI USA Minimum Volatility UCITS ETF", "etf", "EUR", "Euronext Amsterdam", "MIVU.AS"),
    ("LU0486851024", "D5BL", "Xtrackers MSCI Europe Value UCITS ETF", "etf", "EUR", "XETRA", "D5BL.DE"),
    ("LU1875395870", "XDJE", "Xtrackers Nikkei 225 UCITS ETF", "etf", "EUR", "XETRA", "XDJE.DE"),
    ("LU1681038912", "JPNK", "Amundi JPX-Nikkei 400 UCITS ETF", "etf", "EUR", "Euronext Paris", "JPNK.PA"),
    ("IE00B5BMR087", "CSPX", "iShares Core S&P 500 UCITS ETF", "etf", "USD", "LSE", "CSPX.L"),
    ("IE00BZ4BMM98", "EUHD", "Invesco STOXX Europe High Dividend Low Volatility UCITS ETF", "etf", "GBP", "LSE", "EUHD.L"),
    ("IE00B8GKDB10", "VHYL", "Vanguard FTSE All-World High Dividend Yield UCITS ETF", "etf", "GBP", "LSE", "VHYL.L"),
    ("IE00BHZRR030", "FLXK", "Franklin FTSE Korea UCITS ETF", "etf", "USD", "LSE", "FLXK.L"),
    ("IE00BFNM3L97", "SAJP", "iShares MSCI Japan Screened UCITS ETF", "etf", "USD", "LSE", "SAJP.L"),
    ("IE00B02KXH56", "IJPN", "iShares MSCI Japan UCITS ETF", "etf", "GBP", "LSE", "IJPN.L"),
    ("IE00B5W4TY14", "IKOR", "iShares MSCI Korea UCITS ETF", "etf", "GBP", "LSE", "IKOR.L"),
    ("IE00BL25JN58", "XDEB", "Xtrackers MSCI World Minimum Volatility UCITS ETF", "etf", "GBP", "LSE", "XDEB.L"),
    ("IE00BF16M727", "CIBR", "First Trust Nasdaq Cybersecurity UCITS ETF", "etf", "USD", "LSE", "CIBR.L"),
    ("IE00BYXG2H39", "BTEC", "iShares Nasdaq US Biotechnology UCITS ETF", "etf", "USD", "LSE", "BTEC.L"),
    ("IE00B3VSSL01", "XLKS", "Invesco US Technology S&P 500 UCITS ETF", "etf", "USD", "LSE", "XLKS.L"),
    ("IE00B3YCGJ38", "SPXS", "Invesco S&P 500 UCITS ETF Acc", "etf", "USD", "LSE", "SPXS.L"),
    ("IE00B60SX170", "MXUS", "Invesco MSCI USA UCITS ETF", "etf", "USD", "LSE", "MXUS.L"),
    ("IE00B802KR88", "LOWV", "SPDR S&P 500 Low Volatility UCITS ETF", "etf", "USD", "LSE", "LOWV.L"),
    ("IE00B5MTWD60", "X7PS", "Invesco STOXX Europe 600 Optimised Banks UCITS ETF", "etf", "EUR", "LSE", "X7PS.L"),
    ("IE00B5MTXJ97", "EXH6", "Invesco STOXX Europe 600 Insurance UCITS ETF", "etf", "EUR", "XETRA", "EXH6.DE"),
    ("IE00B5MTWZ80", "EXH5", "Invesco STOXX Europe 600 Technology UCITS ETF", "etf", "EUR", "XETRA", "EXH5.DE"),
    ("IE000I8KRLL9", "SEMI", "iShares MSCI Global Semiconductors UCITS ETF", "etf", "GBP", "LSE", "SEMI.L"),
    ("IE000YDZG487", "HNSC", "HSBC Nasdaq Global Semiconductor UCITS ETF", "etf", "EUR", "Borsa Italiana", "HNSC.MI"),
    ("IE0008GRJRO8", "DEFV", "SPDR MSCI Europe Defensive UCITS ETF", "etf", "USD", "LSE", "DEFV.L"),
    ("IE000YS5XL05", "TKNX", "Global X Blockchain UCITS ETF", "etf", "USD", "LSE", "TKNX.L"),
    ("IE00B0M63623", "IDTW", "iShares MSCI Taiwan UCITS ETF", "etf", "USD", "LSE", "IDTW.L"),
    ("IE00BVXC4854", "DXJ", "WisdomTree Japan Equity UCITS ETF USD Hedged", "etf", "USD", "LSE", "DXJ.L"),
    ("IE00B579F325", "SGLD", "Invesco Physical Gold ETC", "etc", "USD", "LSE", "SGLD.L"),
    ("IE00B4NCWG09", "SSLN", "iShares Physical Silver ETC", "etc", "GBP", "LSE", "SSLN.L"),
    ("IE00BQQP9F84", "GDX", "VanEck Gold Miners UCITS ETF", "etf", "USD", "LSE", "GDX.L"),
    ("IE00B6R52036", "SPGP", "iShares Gold Producers UCITS ETF", "etf", "GBP", "LSE", "SPGP.L"),
    ("JE00B2QXZK10", "COCO", "WisdomTree Cocoa ETC", "etc", "USD", "LSE", "COCO.L"),
    ("GB00B15KXV33", "CRUD", "WisdomTree WTI Crude Oil ETC", "etc", "USD", "LSE", "CRUD.L"),
    ("GB00B15KYC19", "AIGO", "WisdomTree Petroleum ETC", "etc", "USD", "LSE", "AIGO.L"),
    ("CNE1000001Z5", "BACHY", "Bank of China Ltd ADR", "adr", "USD", "OTC", "BACHY"),
    ("FR0010930644", "ANRJ", "Amundi Global Hydrogen UCITS ETF", "etf", "EUR", "Euronext Paris", "ANRJ.PA"),
]

# Yahoo quotes London-listed ETFs in pence (GBp) for some securities, and in
# pounds for others. Normalise pence to pounds and expose the real quote
# currency instead of the listing venue's nominal currency.
PRICE_ADJUSTMENTS: dict[str, tuple[str, float]] = {
    "EUHD": ("GBP", 100.0),
    "IJPN": ("GBP", 100.0),
    "IKOR": ("GBP", 100.0),
    "XDEB": ("GBP", 100.0),
    "SSLN": ("GBP", 100.0),
    "SPGP": ("GBP", 100.0),
    "VHYL": ("GBP", 1.0),
    "SEMI": ("GBP", 1.0),
}

# Some Yahoo venues occasionally return an empty frame. Keep alternatives
# beside the primary ticker so the pipeline is resilient.
FALLBACK_TICKERS: dict[str, list[str]] = {
    "US40051E2028": ["ASR", "ASR.MX"],
    "CA2926717083": ["UUUU", "UUUU.MX"],
    "IE00B5MTWD60": ["X7PS.L", "X7PS.DE"],
    "LU1589349734": ["MIVU.AS", "MIVU.PA"],
    "CNE1000001Z5": ["BACHY", "3988.HK"],
}


def clean_frame(frame: pd.DataFrame | None) -> pd.DataFrame | None:
    """Return a single-level OHLC frame with a naive DatetimeIndex."""
    if frame is None or frame.empty:
        return None
    df = frame.copy()
    if isinstance(df.columns, pd.MultiIndex):
        # yfinance returns (field, ticker) columns for a single ticker in v1.x
        if df.columns.nlevels == 2:
            df.columns = df.columns.get_level_values(0)
    df = df.loc[:, ~df.columns.duplicated()]
    needed = {"Open", "High", "Low", "Close"}
    if not needed.issubset(set(df.columns)):
        return None
    df.index = pd.to_datetime(df.index)
    if getattr(df.index, "tz", None) is not None:
        df.index = df.index.tz_localize(None)
    return df.sort_index()


def fetch_daily(ticker: str, start: datetime, end: datetime) -> pd.DataFrame | None:
    candidates = [ticker, *FALLBACK_TICKERS.get(ticker, [])]
    for candidate in candidates:
        try:
            frame = yf.download(
                candidate,
                start=start,
                end=end,
                interval="1d",
                progress=False,
                auto_adjust=True,
                threads=False,
            )
            df = clean_frame(frame)
            if df is not None and len(df) > 20:
                return df
        except Exception as exc:  # pragma: no cover - network dependent
            print(f"  ! {candidate}: {exc}")
    return None


def last_closed_friday(today: date) -> date:
    """The most recent completed Friday (strictly before today)."""
    friday = today - timedelta(days=(today.weekday() - 4) % 7)
    if friday >= today:
        friday -= timedelta(days=7)
    return friday


def find_vix_peaks(vix_daily: pd.DataFrame) -> list[dict]:
    peaks: list[dict] = []
    highs = vix_daily["High"].astype(float).to_numpy()
    closes = vix_daily["Close"].astype(float).to_numpy()
    dates = list(vix_daily.index)

    for i in range(1, len(highs) - 1):
        if (
            highs[i] > VIX_THRESHOLD_PEAK
            and highs[i] > highs[i - 1]
            and highs[i] > highs[i + 1]
        ):
            recovery_date = None
            for j in range(i, len(closes)):
                if closes[j] < VIX_THRESHOLD_RECOVERY:
                    recovery_date = dates[j]
                    break
            peaks.append(
                {
                    "date": dates[i],
                    "high": float(highs[i]),
                    "recovery": recovery_date,
                }
            )
    return peaks


def as_price(series: pd.Series, day: pd.Timestamp | None) -> float | None:
    if day is None:
        return None
    if day in series.index:
        value = series.loc[day]
        if pd.notna(value):
            return float(value)
    # Align a holiday in one market with the nearest trading session.
    nearby = series.index[(series.index >= day - pd.Timedelta(days=3)) & (series.index <= day + pd.Timedelta(days=3))]
    if len(nearby):
        value = series.loc[nearby].iloc[0]
        if pd.notna(value):
            return float(value)
    return None


def calculate_summary(peaks: list[dict]) -> dict:
    valid = [p for p in peaks if p["percentChange"] is not None]
    if not valid:
        return {"meanChange": 0.0, "maxChange": 0.0, "meanDays": 0.0, "meanVix": 0.0}
    return {
        "meanChange": round(sum(p["percentChange"] for p in valid) / len(valid), 2),
        "maxChange": round(max(p["percentChange"] for p in valid), 2),
        "meanDays": round(sum(p["daysToRecovery"] for p in valid) / len(valid), 1),
        "meanVix": round(sum(p["vixPeakValue"] for p in valid) / len(valid), 2),
    }


def build_asset(
    isin: str,
    ticker: str,
    name: str,
    asset_type: str,
    currency: str,
    exchange: str,
    yf_ticker: str,
    asset_daily: pd.DataFrame | None,
    vix_daily: pd.DataFrame,
    vix_peaks: list[dict],
    weekly_dates: list[str],
    weekly_vix: list[float],
) -> dict:
    is_placeholder = asset_daily is None or asset_daily.empty
    if is_placeholder:
        # Never let a single unavailable feed break the build. The UI clearly
        # labels placeholder values.
        asset_daily = simulate_daily(vix_daily.index, name)

    display_currency, price_divisor = PRICE_ADJUSTMENTS.get(ticker, (currency, 1.0))
    daily_close = asset_daily["Close"].astype(float) / price_divisor
    peaks: list[dict] = []
    for peak in vix_peaks:
        price_at_peak = as_price(daily_close, peak["date"])
        if price_at_peak is None:
            continue
        recovery = peak["recovery"]
        if recovery is None:
            peaks.append(
                {
                    "vixPeakDate": peak["date"].strftime("%Y-%m-%d"),
                    "vixPeakValue": round(peak["high"], 2),
                    "assetPriceAtPeak": round(price_at_peak, 4),
                    "vixRecoveryDate": None,
                    "assetPriceAtRecovery": None,
                    "percentChange": None,
                    "daysToRecovery": None,
                }
            )
            continue
        price_at_recovery = as_price(daily_close, recovery)
        if price_at_recovery is None:
            peaks.append(
                {
                    "vixPeakDate": peak["date"].strftime("%Y-%m-%d"),
                    "vixPeakValue": round(peak["high"], 2),
                    "assetPriceAtPeak": round(price_at_peak, 4),
                    "vixRecoveryDate": None,
                    "assetPriceAtRecovery": None,
                    "percentChange": None,
                    "daysToRecovery": None,
                }
            )
            continue
        percent = ((price_at_recovery - price_at_peak) / price_at_peak) * 100
        days = (recovery - peak["date"]).days
        peaks.append(
            {
                "vixPeakDate": peak["date"].strftime("%Y-%m-%d"),
                "vixPeakValue": round(peak["high"], 2),
                "assetPriceAtPeak": round(price_at_peak, 4),
                "vixRecoveryDate": recovery.strftime("%Y-%m-%d"),
                "assetPriceAtRecovery": round(price_at_recovery, 4),
                "percentChange": round(percent, 2),
                "daysToRecovery": days,
            }
        )

    weekly_close = daily_close.resample("W-FRI").last().reindex(pd.to_datetime(weekly_dates))
    weekly_close = weekly_close.ffill()
    price_values: list[float | None] = []
    for value in weekly_close.to_numpy():
        price_values.append(None if pd.isna(value) else round(float(value), 4))

    return {
        "isin": isin,
        "ticker": ticker,
        "name": name,
        "type": asset_type,
        "currency": display_currency,
        "exchange": exchange,
        "peaks": peaks,
        "summary": calculate_summary(peaks),
        "priceSeries": {
            "dates": weekly_dates,
            "vix": weekly_vix,
            "price": price_values,
            "frequency": "weekly",
        },
        "placeholder": is_placeholder,
        "_yahooTicker": yf_ticker,
        "_sourceRows": int(len(daily_close)),
    }


def simulate_daily(index: pd.DatetimeIndex, seed_name: str) -> pd.DataFrame:
    """Deterministic fallback, clearly marked as placeholder in the payload."""
    rng = random.Random(seed_name)
    base = rng.uniform(20, 350)
    values = []
    value = base
    for _ in index:
        value *= 1 + rng.gauss(0.0002, 0.015)
        values.append(value)
    return pd.DataFrame(
        {
            "Open": values,
            "High": [v * 1.01 for v in values],
            "Low": [v * 0.99 for v in values],
            "Close": values,
        },
        index=index,
    )


def main() -> None:
    today = date.today()
    end = datetime.combine(today + timedelta(days=1), datetime.min.time())
    start = datetime.combine(today - timedelta(days=LOOKBACK_YEARS * 365 + 5), datetime.min.time())

    print("Downloading ^VIX daily history...")
    vix_daily = fetch_daily("^VIX", start, end)
    if vix_daily is None:
        raise SystemExit("Could not download ^VIX data")

    last_week = pd.Timestamp(last_closed_friday(today))

    # Current day quote + previous session.
    current_row = vix_daily.iloc[-1]
    previous_row = vix_daily.iloc[-2]
    current_vix = float(current_row["Close"])
    previous_day_vix = float(previous_row["Close"])

    # Weekly VIX series, truncated to the most recent fully completed week.
    weekly_vix_series = vix_daily["Close"].astype(float).resample("W-FRI").last()
    weekly_vix_series = weekly_vix_series[weekly_vix_series.index <= last_week]
    latest_week_vix = float(weekly_vix_series.iloc[-1])
    previous_week_vix = float(weekly_vix_series.iloc[-2])

    change_day_abs = current_vix - previous_day_vix
    change_day_pct = (change_day_abs / previous_day_vix * 100) if previous_day_vix else 0.0
    change_week_abs = latest_week_vix - previous_week_vix
    change_week_pct = (change_week_abs / previous_week_vix * 100) if previous_week_vix else 0.0

    vix_metrics = {
        "currentVix": round(current_vix, 2),
        "currentDate": vix_daily.index[-1].strftime("%Y-%m-%d"),
        "previousDayVix": round(previous_day_vix, 2),
        "previousDayDate": vix_daily.index[-2].strftime("%Y-%m-%d"),
        "changeDayAbs": round(change_day_abs, 2),
        "changeDayPct": round(change_day_pct, 2),
        "latestWeekVix": round(latest_week_vix, 2),
        "latestWeekDate": weekly_vix_series.index[-1].strftime("%Y-%m-%d"),
        "previousWeekVix": round(previous_week_vix, 2),
        "previousWeekDate": weekly_vix_series.index[-2].strftime("%Y-%m-%d"),
        "changeWeekAbs": round(change_week_abs, 2),
        "changeWeekPct": round(change_week_pct, 2),
    }

    weekly_dates = [d.strftime("%Y-%m-%d") for d in weekly_vix_series.index]
    weekly_vix = [round(float(v), 2) for v in weekly_vix_series.to_numpy()]

    vix_peaks = find_vix_peaks(vix_daily)
    print(f"Detected {len(vix_peaks)} VIX peaks; weekly window {weekly_dates[0]} -> {weekly_dates[-1]}")

    assets: list[dict] = []
    for position, (isin, ticker, name, asset_type, currency, exchange, yf_ticker) in enumerate(ASSETS, 1):
        print(f"[{position:02d}/{len(ASSETS)}] {ticker:<6} {name[:48]}")
        daily = fetch_daily(yf_ticker, start, end)
        assets.append(
            build_asset(
                isin,
                ticker,
                name,
                asset_type,
                currency,
                exchange,
                yf_ticker,
                daily,
                vix_daily,
                vix_peaks,
                weekly_dates,
                weekly_vix,
            )
        )

    dataset = {
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "vixThresholdPeak": VIX_THRESHOLD_PEAK,
        "vixThresholdRecovery": VIX_THRESHOLD_RECOVERY,
        "dateRange": {"from": weekly_dates[0], "to": weekly_dates[-1]},
        "vixMetrics": vix_metrics,
        "assets": [{k: v for k, v in asset.items() if not k.startswith("_")} for asset in assets],
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as handle:
        json.dump(dataset, handle, indent=2, ensure_ascii=False, allow_nan=False)

    placeholders = sum(1 for asset in assets if asset["placeholder"])
    print(f"\nSaved {len(assets)} assets ({placeholders} placeholders) to {OUTPUT}")
    print(f"Current VIX {vix_metrics['currentVix']} ({vix_metrics['currentDate']}), "
          f"latest closed week {vix_metrics['latestWeekVix']} ({vix_metrics['latestWeekDate']})")


if __name__ == "__main__":
    main()
