import { loadThreshold, saveThreshold } from '@/lib/settingsStorage'

export const MAGNIFY_MIN = 0
export const MAGNIFY_MAX = 100
export const MAGNIFY_STEP = 5
export const DEFAULT_MAGNIFICATION = 0

const STORAGE_KEY = 'chart-magnification'

/**
 * The slider is a 0–100 magnification scale in steps of 5. 0 leaves the chart
 * at its full time range; 100 shows only the latest 1% of the timeline
 * (100× zoom).
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

type TimeWindow = { start: number; end: number }

/**
 * Returns the dataZoom percentages for the selected magnification. The window
 * is anchored to the latest data, so every chart compares the same share of
 * its timeline at any given magnification level.
 */
export function getMagnificationWindow(magnification: number): TimeWindow {
  const visiblePercent = magnificationToVisiblePercent(magnification)
  return { start: 100 - visiblePercent, end: 100 }
}
