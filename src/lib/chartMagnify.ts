import { loadThreshold, saveThreshold } from '@/lib/settingsStorage'

export const MAGNIFY_MIN = 0
export const MAGNIFY_MAX = 100
export const MAGNIFY_STEP = 5
export const DEFAULT_MAGNIFICATION = 0

const STORAGE_KEY = 'chart-magnification'

/**
 * The slider is a 0–100 magnification scale in steps of 5. 0 leaves the chart
 * at its normal (full-range) vertical scale; 100 shows only the middle 1% of
 * the vertical range (100× zoom).
 */
export function normalizeMagnification(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MAGNIFICATION
  const clamped = Math.max(MAGNIFY_MIN, Math.min(MAGNIFY_MAX, value))
  return Math.round(clamped / MAGNIFY_STEP) * MAGNIFY_STEP
}

export function magnificationToVisiblePercent(magnification: number): number {
  return Math.max(1, 100 - normalizeMagnification(magnification))
}

export function magnificationToZoomFactor(magnification: number): number {
  return 100 / magnificationToVisiblePercent(magnification)
}

export function loadChartMagnification(): number {
  return normalizeMagnification(loadThreshold(STORAGE_KEY, DEFAULT_MAGNIFICATION))
}

export function saveChartMagnification(value: number) {
  saveThreshold(STORAGE_KEY, normalizeMagnification(value))
}

type AxisRange = { min?: number; max?: number }

/**
 * Returns explicit y-axis bounds that zoom the vertical scale around the
 * midpoint of the data. Every chart uses the same magnification value, so the
 * visible share of each chart's own vertical extent is identical.
 */
export function getMagnifiedAxisRange(
  values: ReadonlyArray<number | null | undefined>,
  magnification: number,
): AxisRange {
  const normalized = normalizeMagnification(magnification)
  if (normalized === MAGNIFY_MIN) return {}

  let dataMin = Infinity
  let dataMax = -Infinity
  for (const value of values) {
    if (value === null || value === undefined || !Number.isFinite(value)) continue
    if (value < dataMin) dataMin = value
    if (value > dataMax) dataMax = value
  }
  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax) || dataMin === dataMax) return {}

  const center = (dataMin + dataMax) / 2
  const fullSpan = dataMax - dataMin
  const visibleSpan = fullSpan * (magnificationToVisiblePercent(normalized) / 100)
  // A small margin keeps the lines just inside the plot area at high zoom.
  const padding = visibleSpan * 0.02
  const halfSpan = visibleSpan / 2 + padding

  return { min: center - halfSpan, max: center + halfSpan }
}
