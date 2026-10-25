#!/usr/bin/env python3
import json
from datetime import datetime, timedelta
from pathlib import Path

try:
    import yfinance as yf
    import pandas as pd
    import numpy as np
except ImportError:
    print("Please install requirements: pip install -r requirements.txt")
    exit(1)

VIX_THRESHOLD_PEAK = 21
VIX_THRESHOLD_RECOVERY = 20

ASSET_LIST = [
    "US5951121038", "US67066G1040", "US88160R1014", "US0378331005", "US5949181045",
    "US46625H1005", "US0605051046", "US9311421039", "US92826C8394", "US4592001014",
    "US0028241000", "US68389X1054", "US4370761029", "US6516391066", "CA0084741085",
    "CA13321L1085", "CA2926717083", "DE000HAG0005", "DE0007030009", "US21037T1097",
    "US3453708600", "US40051E2028", "US4622221004", "US65336K1034", "US2296631094",
    "US8334451098", "LU1778762911", "LU1861132840", "LU1900066033", "LU1900066975",
    "LU1589349734", "LU0486851024", "LU1875395870", "LU1681038912",
    "IE00B5BMR087", "IE00BZ4BMM98", "IE00B8GKDB10", "IE00BHZRR030", "IE00BFNM3L97",
    "IE00B02KXH56", "IE00B5W4TY14", "IE00BL25JN58", "IE00BF16M727", "IE00BYXG2H39",
    "IE00B3VSSL01", "IE00B3YCGJ38", "IE00B60SX170", "IE00B802KR88", "IE00B5MTWD60",
    "IE00B5MTXJ97", "IE00B5MTWZ80", "IE000I8KRLL9", "IE000YDZG487", "IE0008GRJRO8",
    "IE000YS5XL05", "IE00B0M63623", "IE00BVXC4854", "IE00B579F325", "IE00B4NCWG09",
    "IE00BQQP9F84", "IE00B6R52036", "JE00B2QXZK10", "GB00B15KXV33", "GB00B15KYC19",
    "CNE1000001Z5", "FR0010930644"
]

# Load FIGI mapping
figi_path = Path(__file__).parent.parent / "figi_result.json"
figi_data = {}
if figi_path.exists():
    with open(figi_path) as f:
        figi_data = json.load(f)

def find_vix_peaks(vix_df):
    peaks = []
    for i in range(1, len(vix_df) - 1):
        curr = vix_df.iloc[i]
        prev = vix_df.iloc[i-1]
        next_row = vix_df.iloc[i+1]
        if curr['High'] > VIX_THRESHOLD_PEAK and curr['High'] > prev['High'] and curr['High'] > next_row['High']:
            peaks.append({
                'date': curr.name.strftime('%Y-%m-%d'),
                'high': float(curr['High']),
                'index': i,
                'close': float(curr['Close'])
            })
    return peaks

def find_recovery_date(vix_df, peak_index):
    for i in range(peak_index, len(vix_df)):
        if vix_df.iloc[i]['Close'] < VIX_THRESHOLD_RECOVERY:
            return vix_df.iloc[i].name.strftime('%Y-%m-%d')
    return None

def calculate_days_between(date1, date2):
    d1 = datetime.strptime(date1, '%Y-%m-%d')
    d2 = datetime.strptime(date2, '%Y-%m-%d')
    return (d2 - d1).days

def process_asset(ticker, isin, name, asset_type, exchange):
    try:
        # Download data
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365*10)  # 10 years
        asset_data = yf.download(ticker, start=start_date, end=end_date, progress=False)
        vix_data = yf.download('^VIX', start=start_date, end=end_date, progress=False)
        
        if asset_data.empty or vix_data.empty:
            print(f"Warning: No data for {ticker} ({isin})")
            return None
        
        # Normalize index
        asset_data.index = pd.to_datetime(asset_data.index).tz_localize(None)
        vix_data.index = pd.to_datetime(vix_data.index).tz_localize(None)
        
        peaks_info = find_vix_peaks(vix_data)
        asset_peaks = []
        
        for peak in peaks_info:
            peak_date = peak['date']
            # Find asset price at peak
            try:
                asset_price_at_peak = float(asset_data.loc[peak_date]['Close'])
            except:
                # Try to find nearest
                try:
                    idx = asset_data.index.get_indexer([pd.to_datetime(peak_date)], method='nearest')[0]
                    asset_price_at_peak = float(asset_data.iloc[idx]['Close'])
                except:
                    continue
            
            recovery_date = find_recovery_date(vix_data, peak['index'])
            if recovery_date is None:
                asset_peaks.append({
                    "vixPeakDate": peak_date,
                    "vixPeakValue": peak['high'],
                    "assetPriceAtPeak": round(asset_price_at_peak, 2),
                    "vixRecoveryDate": None,
                    "assetPriceAtRecovery": None,
                    "percentChange": None,
                    "daysToRecovery": None
                })
                continue
            
            try:
                asset_price_at_recovery = float(asset_data.loc[recovery_date]['Close'])
            except:
                try:
                    idx = asset_data.index.get_indexer([pd.to_datetime(recovery_date)], method='nearest')[0]
                    asset_price_at_recovery = float(asset_data.iloc[idx]['Close'])
                except:
                    asset_peaks.append({
                        "vixPeakDate": peak_date,
                        "vixPeakValue": peak['high'],
                        "assetPriceAtPeak": round(asset_price_at_peak, 2),
                        "vixRecoveryDate": None,
                        "assetPriceAtRecovery": None,
                        "percentChange": None,
                        "daysToRecovery": None
                    })
                    continue
            
            percent_change = ((asset_price_at_recovery - asset_price_at_peak) / asset_price_at_peak) * 100
            days_to_recovery = calculate_days_between(peak_date, recovery_date)
            
            asset_peaks.append({
                "vixPeakDate": peak_date,
                "vixPeakValue": round(peak['high'], 2),
                "assetPriceAtPeak": round(asset_price_at_peak, 2),
                "vixRecoveryDate": recovery_date,
                "assetPriceAtRecovery": round(asset_price_at_recovery, 2),
                "percentChange": round(percent_change, 2),
                "daysToRecovery": days_to_recovery
            })
        
        # Calculate summary
        valid_peaks = [p for p in asset_peaks if p['percentChange'] is not None]
        if valid_peaks:
            mean_change = sum(p['percentChange'] for p in valid_peaks) / len(valid_peaks)
            max_change = max(p['percentChange'] for p in valid_peaks)
            mean_days = sum(p['daysToRecovery'] for p in valid_peaks) / len(valid_peaks)
            mean_vix = sum(p['vixPeakValue'] for p in valid_peaks) / len(valid_peaks)
        else:
            mean_change = max_change = mean_days = mean_vix = 0
        
        # Build price series (aligned)
        all_dates = sorted(set([d.strftime('%Y-%m-%d') for d in asset_data.index] & [d.strftime('%Y-%m-%d') for d in vix_data.index]))
        dates_out = all_dates[::5]  # Sample for performance
        price_series = {
            "dates": dates_out,
            "vix": [],
            "price": []
        }
        for d in dates_out:
            try:
                price_series['vix'].append(round(float(vix_data.loc[d]['Close']), 2))
            except:
                price_series['vix'].append(None)
            try:
                price_series['price'].append(round(float(asset_data.loc[d]['Close']), 2))
            except:
                price_series['price'].append(None)
        
        # Determine type
        figi_info = figi_data.get(isin, {})
        sec_type = figi_info.get('securityType', '')
        if sec_type == 'ETP':
            asset_type_res = 'etf'
        elif 'ETC' in str(figi_info.get('name', '')).upper():
            asset_type_res = 'etc'
        elif sec_type == 'Depositary Receipt':
            asset_type_res = 'adr'
        else:
            asset_type_res = 'stock'
        
        return {
            "isin": isin,
            "ticker": figi_info.get('ticker', ticker),
            "name": figi_info.get('name', ticker),
            "type": asset_type_res,
            "currency": "USD",
            "exchange": figi_info.get('exchCode', exchange),
            "peaks": asset_peaks,
            "summary": {
                "meanChange": round(mean_change, 2),
                "maxChange": round(max_change, 2),
                "meanDays": round(mean_days, 1),
                "meanVix": round(mean_vix, 2)
            },
            "priceSeries": price_series,
            "placeholder": False
        }
    except Exception as e:
        print(f"Error processing {ticker}: {e}")
        return None

def main():
    print("Fetching VIX Pulse data...")
    assets = []
    
    # Map ISIN to likely tickers
    isin_to_ticker = {
        "US5951121038": "MU", "US67066G1040": "NVDA", "US88160R1014": "TSLA", 
        "US0378331005": "AAPL", "US5949181045": "MSFT", "US46625H1005": "JPM",
        "US0605051046": "BAC", "US9311421039": "WMT", "US92826C8394": "V",
        "US4592001014": "IBM", "US0028241000": "ABT", "US68389X1054": "ORCL",
        "US4370761029": "HD", "US6516391066": "NEE", "CA0084741085": "AG",
        "CA13321L1085": "ABX", "CA2926717083": "EMA", "DE000HAG0005": "HAG.DE",
        "DE0007030009": "RHM.DE", "US21037T1097": "CLSK", "US3453708600": "F",
        "US40051E2028": "USO", "US4622221004": "IONQ", "US65336K1034": "NIO",
        "US2296631094": "CLF", "US8334451098": "SOUN", "LU1778762911": "ESGU",
        "LU1861132840": "ESGE", "LU1900066033": "XLY", "LU1900066975": "XLK",
        "LU1589349734": "IEFA", "LU0486851024": "EEM", "LU1875395870": "XLU",
        "LU1681038912": "IBIT", "IE00B5BMR087": "VWO", "IE00BZ4BMM98": "EWJ",
        "IE00B8GKDB10": "VNGGF", "IE00BHZRR030": "FLXK", "IE00BFNM3L97": "SAJP",
        "IE00B02KXH56": "EWJ", "IE00B5W4TY14": "EWY", "IE00BL25JN58": "XDEB",
        "IE00BF16M727": "CIBR", "IE00BYXG2H39": "IBB", "IE00B3VSSL01": "IXN",
        "IE00B3YCGJ38": "VOO", "IE00B60SX170": "MXCUF", "IE00B802KR88": "SGGSF",
        "IE00B5MTWD60": "X7PS", "IE00B5MTXJ97": "0MTC", "IE00B5MTWZ80": "0MTB",
        "IE000I8KRLL9": "SMH", "IE000YDZG487": "HNSC", "IE0008GRJRO8": "DEFV",
        "IE000YS5XL05": "TKNX", "IE00B0M63623": "EWT", "IE00BVXC4854": "DXJJF",
        "IE00B579F325": "IAU", "IE00B4NCWG09": "SLV", "IE00BQQP9F84": "GDX",
        "IE00B6R52036": "GOAU", "JE00B2QXZK10": "NIB", "GB00B15KXV33": "USO",
        "GB00B15KYC19": "BNO", "CNE1000001Z5": "1398.HK", "FR0010930644": "AMIPF"
    }
    
    for isin in ASSET_LIST:
        ticker = isin_to_ticker.get(isin, isin)
        figi_info = figi_data.get(isin, {})
        result = process_asset(ticker, isin, figi_info.get('name', ticker), 'stock', figi_info.get('exchCode', 'US'))
        if result:
            assets.append(result)
            print(f"Processed {result['ticker']} ({isin}): {len(result['peaks'])} peaks")
    
    dataset = {
        "generatedAt": datetime.now().isoformat() + "Z",
        "vixThresholdPeak": VIX_THRESHOLD_PEAK,
        "vixThresholdRecovery": VIX_THRESHOLD_RECOVERY,
        "dateRange": {"from": "2015-01-01", "to": datetime.now().strftime('%Y-%m-%d')},
        "assets": assets
    }
    
    output_path = Path(__file__).parent.parent / "public" / "data" / "vix-pulse.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(dataset, f, indent=2)
    
    print(f"\nSaved {len(assets)} assets to {output_path}")

if __name__ == "__main__":
    main()
