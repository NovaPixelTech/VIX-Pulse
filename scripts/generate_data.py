#!/usr/bin/env python3
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

VIX_THRESHOLD_PEAK = 21
VIX_THRESHOLD_RECOVERY = 20

ASSET_LIST = [
    ("US5951121038", "MU", "Micron Technology Inc", "stock", "NASDAQ"),
    ("US67066G1040", "NVDA", "NVIDIA Corporation", "stock", "NASDAQ"),
    ("US88160R1014", "TSLA", "Tesla Inc", "stock", "NASDAQ"),
    ("US0378331005", "AAPL", "Apple Inc", "stock", "NASDAQ"),
    ("US5949181045", "MSFT", "Microsoft Corporation", "stock", "NASDAQ"),
    ("US46625H1005", "JPM", "JPMorgan Chase & Co", "stock", "NYSE"),
    ("US0605051046", "BAC", "Bank of America Corp", "stock", "NYSE"),
    ("US9311421039", "WMT", "Walmart Inc", "stock", "NYSE"),
    ("US92826C8394", "V", "Visa Inc", "stock", "NYSE"),
    ("US4592001014", "IBM", "International Business Machines", "stock", "NYSE"),
    ("US0028241000", "ABT", "Abbott Laboratories", "stock", "NYSE"),
    ("US68389X1054", "ORCL", "Oracle Corporation", "stock", "NYSE"),
    ("US4370761029", "HD", "Home Depot Inc", "stock", "NYSE"),
    ("US6516391066", "NEE", "NextEra Energy Inc", "stock", "NYSE"),
    ("CA0084741085", "AGI", "Alamos Gold Inc", "stock", "NYSE"),
    ("CA13321L1085", "ABX", "Barrick Gold Corp", "stock", "NYSE"),
    ("CA2926717083", "EMA", "Emera Inc", "stock", "NYSE"),
    ("DE000HAG0005", "HAG", "Hensoldt AG", "stock", "XETRA"),
    ("DE0007030009", "RHM", "Rheinmetall AG", "stock", "XETRA"),
    ("US21037T1097", "CLSK", "CleanSpark Inc", "stock", "NASDAQ"),
    ("US3453708600", "F", "Ford Motor Company", "stock", "NYSE"),
    ("US40051E2028", "USO", "United States Oil Fund", "etf", "NYSE"),
    ("US4622221004", "IONQ", "IonQ Inc", "stock", "NYSE"),
    ("US65336K1034", "NIO", "NIO Inc", "adr", "NYSE"),
    ("US2296631094", "CLF", "Cleveland-Cliffs Inc", "stock", "NYSE"),
    ("US8334451098", "SOUN", "SoundHound AI Inc", "stock", "NASDAQ"),
    ("LU1778762911", "ESGU", "iShares ESG Aware MSCI USA", "etf", "NASDAQ"),
    ("LU1861132840", "ESGE", "iShares ESG Aware MSCI EM", "etf", "NASDAQ"),
    ("LU1900066033", "XLY", "Consumer Discretionary SPDR", "etf", "NYSE"),
    ("LU1900066975", "XLK", "Technology Select Sector SPDR", "etf", "NYSE"),
    ("LU1589349734", "IEFA", "iShares Core MSCI EAFE ETF", "etf", "NASDAQ"),
    ("LU0486851024", "EEM", "iShares MSCI Emerging Markets", "etf", "NYSE"),
    ("LU1875395870", "XLU", "Utilities Select Sector SPDR", "etf", "NYSE"),
    ("LU1681038912", "IBIT", "iShares Bitcoin Trust", "etf", "NASDAQ"),
    ("IE00B5BMR087", "VWO", "Vanguard FTSE Emerging Markets", "etf", "NYSE"),
    ("IE00BZ4BMM98", "EWJ", "iShares MSCI Japan ETF", "etf", "NYSE"),
    ("IE00B8GKDB10", "VYM", "Vanguard High Dividend Yield", "etf", "NYSE"),
    ("IE00BHZRR030", "FLKR", "Franklin FTSE Korea ETF", "etf", "NYSE"),
    ("IE00BFNM3L97", "HEWC", "iShares MSCI Japan Small-Cap", "etf", "NYSE"),
    ("IE00B02KXH56", "EWJV", "iShares MSCI Japan Value", "etf", "NYSE"),
    ("IE00B5W4TY14", "EWY", "iShares MSCI South Korea", "etf", "NYSE"),
    ("IE00BL25JN58", "XMVM", "Xtrackers MSCI World Min Vol", "etf", "XETRA"),
    ("IE00BF16M727", "CIBR", "First Trust NASDAQ Cybersecurity", "etf", "NASDAQ"),
    ("IE00BYXG2H39", "IBB", "iShares Nasdaq Biotechnology", "etf", "NASDAQ"),
    ("IE00B3VSSL01", "IGM", "iShares Expanded Tech Sector", "etf", "NYSE"),
    ("IE00B3YCGJ38", "VOO", "Vanguard S&P 500 ETF", "etf", "NYSE"),
    ("IE00B60SX170", "MXUS", "iShares MSCI USA ETF", "etf", "NYSE"),
    ("IE00B802KR88", "SPLV", "Invesco S&P 500 Low Volatility", "etf", "NYSE"),
    ("IE00B5MTWD60", "DBPK", "Xtrackers MSCI Europe Banks", "etf", "XETRA"),
    ("IE00B5MTXJ97", "DBPS", "Xtrackers MSCI Europe Insurance", "etf", "XETRA"),
    ("IE00B5MTWZ80", "DBPT", "Xtrackers MSCI Europe Tech", "etf", "XETRA"),
    ("IE000I8KRLL9", "SOXX", "iShares Semiconductor ETF", "etf", "NASDAQ"),
    ("IE000YDZG487", "HSIC", "HSBC MSCI World Semiconductor", "etf", "LSE"),
    ("IE0008GRJRO8", "EUDF", "SPDR MSCI Europe Defensive", "etf", "LSE"),
    ("IE000YS5XL05", "STAX", "Global X Blockchain ETF", "etf", "NASDAQ"),
    ("IE00B0M63623", "EWT", "iShares MSCI Taiwan ETF", "etf", "NYSE"),
    ("IE00BVXC4854", "DBJP", "Xtrackers MSCI Japan Hedged", "etf", "XETRA"),
    ("IE00B579F325", "SGOL", "Abrdn Physical Gold Shares", "etc", "NYSE"),
    ("IE00B4NCWG09", "SIVR", "Abrdn Physical Silver Shares", "etc", "NYSE"),
    ("IE00BQQP9F84", "GDX", "VanEck Gold Miners ETF", "etf", "NYSE"),
    ("IE00B6R52036", "GDXJ", "VanEck Junior Gold Miners", "etf", "NYSE"),
    ("JE00B2QXZK10", "COW", "iPath Bloomberg Cocoa ETN", "etc", "NYSE"),
    ("GB00B15KXV33", "USO", "United States Oil Fund LP", "etf", "NYSE"),
    ("GB00B15KYC19", "BNO", "United States Brent Oil Fund", "etf", "NYSE"),
    ("CNE1000001Z5", "BACHY", "Bank of China Ltd", "adr", "OTC"),
    ("FR0010930644", "HYDR", "Amundi Global Hydrogen ESG", "etf", "EPA"),
]

# Historical VIX peak events (approximate)
VIX_PEAKS = [
    ("2020-03-16", 82.69),
    ("2020-03-18", 76.45),
    ("2020-04-06", 46.80),
    ("2020-05-18", 35.98),
    ("2022-03-07", 36.45),
    ("2022-06-13", 34.75),
    ("2022-09-28", 32.59),
    ("2022-10-24", 33.63),
    ("2023-03-13", 26.52),
    ("2023-10-27", 21.27),
    ("2024-08-05", 38.57),
    ("2025-04-07", 45.31),
    ("2025-04-21", 30.89),
]

def generate_dates():
    dates = []
    start = datetime(2019, 1, 2)
    end = datetime(2026, 10, 1)
    d = start
    while d <= end:
        if d.weekday() < 5:
            dates.append(d.strftime('%Y-%m-%d'))
        d += timedelta(days=1)
    return dates

def main():
    dates = generate_dates()
    assets_result = []
    
    for isin, ticker, name, atype, exchange in ASSET_LIST:
        # Generate base price
        base_price = random.uniform(10, 500)
        trend = random.uniform(-0.0002, 0.0003)
        
        prices = []
        price_map = {}
        for i, date in enumerate(dates):
            # Add some volatility
            vol = random.gauss(0, 0.015)
            if i == 0:
                p = base_price
            else:
                p = prices[-1] * (1 + trend + vol)
            prices.append(round(p, 2))
            price_map[date] = p
        
        # Generate VIX series
        vix_prices = []
        vix_map = {}
        vix_base = 16
        for i, date in enumerate(dates):
            # Simulate spikes around peak dates
            spike = 0
            for peak_date, peak_val in VIX_PEAKS:
                peak_dt = datetime.strptime(peak_date, '%Y-%m-%d')
                curr_dt = datetime.strptime(date, '%Y-%m-%d')
                days_diff = abs((curr_dt - peak_dt).days)
                if days_diff <= 2:
                    spike = peak_val - vix_base
                elif days_diff <= 5:
                    spike = (peak_val - vix_base) * 0.6
                elif days_diff <= 10:
                    spike = (peak_val - vix_base) * 0.3
            v = vix_base + spike + random.gauss(0, 1)
            v = max(12, min(90, v))
            vix_prices.append(round(v, 2))
            vix_map[date] = v
        
        # Process peaks
        peaks = []
        for peak_date, peak_val in VIX_PEAKS:
            if peak_date not in price_map:
                continue
            asset_at_peak = price_map[peak_date]
            
            # Find recovery
            recovery_date = None
            idx = dates.index(peak_date) if peak_date in dates else -1
            if idx >= 0:
                for j in range(idx, min(idx + 60, len(dates))):
                    if vix_map.get(dates[j], 100) < VIX_THRESHOLD_RECOVERY:
                        recovery_date = dates[j]
                        break
            
            if recovery_date and recovery_date in price_map:
                asset_at_recovery = price_map[recovery_date]
                pct = ((asset_at_recovery - asset_at_peak) / asset_at_peak) * 100
                days = (datetime.strptime(recovery_date, '%Y-%m-%d') - datetime.strptime(peak_date, '%Y-%m-%d')).days
                peaks.append({
                    "vixPeakDate": peak_date,
                    "vixPeakValue": round(peak_val, 2),
                    "assetPriceAtPeak": round(asset_at_peak, 2),
                    "vixRecoveryDate": recovery_date,
                    "assetPriceAtRecovery": round(asset_at_recovery, 2),
                    "percentChange": round(pct, 2),
                    "daysToRecovery": days
                })
            else:
                peaks.append({
                    "vixPeakDate": peak_date,
                    "vixPeakValue": round(peak_val, 2),
                    "assetPriceAtPeak": round(asset_at_peak, 2),
                    "vixRecoveryDate": None,
                    "assetPriceAtRecovery": None,
                    "percentChange": None,
                    "daysToRecovery": None
                })
        
        valid = [p for p in peaks if p['percentChange'] is not None]
        if valid:
            mean_change = sum(p['percentChange'] for p in valid) / len(valid)
            max_change = max(p['percentChange'] for p in valid)
            mean_days = sum(p['daysToRecovery'] for p in valid) / len(valid)
            mean_vix = sum(p['vixPeakValue'] for p in valid) / len(valid)
        else:
            mean_change = max_change = mean_days = mean_vix = 0
        
        # Sample price series
        sample_dates = dates[::10]
        price_series = {
            "dates": sample_dates,
            "vix": [vix_map.get(d) for d in sample_dates],
            "price": [price_map.get(d) for d in sample_dates]
        }
        
        assets_result.append({
            "isin": isin,
            "ticker": ticker,
            "name": name,
            "type": atype,
            "currency": "USD",
            "exchange": exchange,
            "peaks": peaks,
            "summary": {
                "meanChange": round(mean_change, 2),
                "maxChange": round(max_change, 2),
                "meanDays": round(mean_days, 1),
                "meanVix": round(mean_vix, 2)
            },
            "priceSeries": price_series,
            "placeholder": True
        })
        print(f"Generated {ticker}")
    
    dataset = {
        "generatedAt": datetime.now().isoformat() + "Z",
        "vixThresholdPeak": VIX_THRESHOLD_PEAK,
        "vixThresholdRecovery": VIX_THRESHOLD_RECOVERY,
        "dateRange": {"from": dates[0], "to": dates[-1]},
        "assets": assets_result
    }
    
    output_path = Path(__file__).parent.parent / "public" / "data" / "vix-pulse.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(dataset, f, indent=2)
    print(f"\nSaved {len(assets_result)} assets")

if __name__ == "__main__":
    main()
