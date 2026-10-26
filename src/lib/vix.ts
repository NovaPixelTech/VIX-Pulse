import type { Asset, Dataset, VixMetrics } from '@/types'

export type VixRegimeKey = 'low' | 'normal' | 'elevated' | 'high'

export interface VixRegime {
  key: VixRegimeKey
  label: string
  range: string
  description: string
  textClass: string
  bgClass: string
  borderClass: string
  dotClass: string
}

const REGIMES: Record<VixRegimeKey, VixRegime> = {
  low: {
    key: 'low',
    label: 'Low',
    range: '< 15',
    description: 'Calm markets; volatility is unusually subdued.',
    textClass: 'text-sky-700 dark:text-sky-400',
    bgClass: 'bg-sky-500/10',
    borderClass: 'border-sky-500/30',
    dotClass: 'bg-sky-400',
  },
  normal: {
    key: 'normal',
    label: 'Normal',
    range: '15 – < 20',
    description: 'A typical, balanced level of market volatility.',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
  elevated: {
    key: 'elevated',
    label: 'Elevated',
    range: '20 – < 30',
    description: 'Investors are pricing more risk than usual.',
    textClass: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    dotClass: 'bg-amber-400',
  },
  high: {
    key: 'high',
    label: 'High',
    range: '≥ 30',
    description: 'Acute stress; markets are highly volatile.',
    textClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    dotClass: 'bg-red-400',
  },
}

export function getVixRegime(value: number | null | undefined): VixRegime {
  if (value === null || value === undefined || Number.isNaN(value)) return REGIMES.normal
  if (value < 15) return REGIMES.low
  if (value < 20) return REGIMES.normal
  if (value < 30) return REGIMES.elevated
  return REGIMES.high
}

export function deriveVixMetrics(data: Dataset): VixMetrics | null {
  if (data.vixMetrics) return data.vixMetrics
  const source = data.assets.find((asset) => asset.priceSeries.vix.some((value) => value !== null))
  if (!source) return null

  const points = source.priceSeries.dates
    .map((date, index) => ({ date, value: source.priceSeries.vix[index] }))
    .filter((point): point is { date: string; value: number } => point.value !== null)

  if (points.length < 2) return null
  const current = points[points.length - 1]
  const previous = points[points.length - 2]
  const changeAbs = current.value - previous.value
  const changePct = previous.value ? (changeAbs / previous.value) * 100 : 0

  return {
    currentVix: current.value,
    currentDate: current.date,
    previousDayVix: previous.value,
    previousDayDate: previous.date,
    changeDayAbs: Number(changeAbs.toFixed(2)),
    changeDayPct: Number(changePct.toFixed(2)),
    latestWeekVix: current.value,
    latestWeekDate: current.date,
    previousWeekVix: previous.value,
    previousWeekDate: previous.date,
    changeWeekAbs: Number(changeAbs.toFixed(2)),
    changeWeekPct: Number(changePct.toFixed(2)),
  }
}

export interface WeeklyStats {
  latest: number | null
  previous: number | null
  changeAbs: number | null
  changePct: number | null
}

export function getWeeklyStats(asset: Asset): WeeklyStats {
  const prices = asset.priceSeries.price.filter((value): value is number => value !== null)
  if (prices.length === 0) return { latest: null, previous: null, changeAbs: null, changePct: null }
  const latest = prices[prices.length - 1]
  const previous = prices.length > 1 ? prices[prices.length - 2] : null
  const changeAbs = previous !== null ? latest - previous : null
  const changePct = previous ? (changeAbs! / previous) * 100 : null
  return { latest, previous, changeAbs, changePct }
}

export function nearestWeeklyDate(dates: string[], target: string): string | null {
  if (!dates.length) return null
  if (dates.includes(target)) return target
  const targetTime = new Date(`${target}T00:00:00Z`).getTime()
  let best = dates[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const date of dates) {
    const distance = Math.abs(new Date(`${date}T00:00:00Z`).getTime() - targetTime)
    if (distance < bestDistance) {
      best = date
      bestDistance = distance
    }
  }
  return best
}
