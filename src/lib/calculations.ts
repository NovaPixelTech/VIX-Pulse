export const VIX_THRESHOLD_PEAK = 21
export const VIX_THRESHOLD_RECOVERY = 20

export interface VIXData {
  date: string
  high: number
  close: number
}

export function findVixPeaks(vixData: VIXData[]): Array<{ date: string; high: number; index: number }> {
  const peaks: Array<{ date: string; high: number; index: number }> = []
  
  for (let i = 1; i < vixData.length - 1; i++) {
    const curr = vixData[i]
    const prev = vixData[i - 1]
    const next = vixData[i + 1]
    
    if (curr.high > VIX_THRESHOLD_PEAK &&
        curr.high > prev.high &&
        curr.high > next.high) {
      peaks.push({ date: curr.date, high: curr.high, index: i })
    }
  }
  
  return peaks
}

export function findRecoveryDate(vixData: VIXData[], peakIndex: number): string | null {
  for (let i = peakIndex; i < vixData.length; i++) {
    if (vixData[i].close < VIX_THRESHOLD_RECOVERY) {
      return vixData[i].date
    }
  }
  return null
}

export function calculatePercentChange(assetPriceAtPeak: number, assetPriceAtRecovery: number): number {
  return ((assetPriceAtRecovery - assetPriceAtPeak) / assetPriceAtPeak) * 100
}

export function calculateDaysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function calculateAssetSummary(peaks: any[]) {
  const validPeaks = peaks.filter(p => p.percentChange !== null)
  
  if (validPeaks.length === 0) {
    return {
      meanChange: 0,
      maxChange: 0,
      meanDays: 0,
      meanVix: 0,
    }
  }
  
  const meanChange = validPeaks.reduce((sum, p) => sum + (p.percentChange || 0), 0) / validPeaks.length
  const maxChange = Math.max(...validPeaks.map(p => p.percentChange || 0))
  const meanDays = validPeaks.reduce((sum, p) => sum + (p.daysToRecovery || 0), 0) / validPeaks.length
  const meanVix = validPeaks.reduce((sum, p) => sum + p.vixPeakValue, 0) / validPeaks.length
  
  return {
    meanChange,
    maxChange,
    meanDays,
    meanVix,
  }
}
