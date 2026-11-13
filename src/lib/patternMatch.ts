export const MIN_PATTERN_LENGTH = 5
export const DEFAULT_PATTERN_THRESHOLD = 0.85

export interface PatternMatch {
  startIndex: number
  endIndex: number
  /** Pearson correlation of the z-normalised windows, from -1 to 1. */
  score: number
}

export interface JointPatternMatch extends PatternMatch {
  /**
   * Correlation for each input series, in the same order as the input. The
   * combined `score` is the weakest of these values, so every series must
   * match before a period is reported.
   */
  seriesScores: number[]
}

interface PatternSearchOptions {
  /** Minimum correlation, from 0 to 1. Defaults to 0.85. */
  threshold?: number
  /** Maximum number of non-overlapping matches to return. Defaults to 8. */
  maxMatches?: number
}

function zNormalize(values: ReadonlyArray<number>): Float64Array | null {
  let sum = 0
  for (const value of values) sum += value
  const mean = sum / values.length

  let squared = 0
  for (const value of values) {
    const delta = value - mean
    squared += delta * delta
  }
  const variance = squared / values.length
  if (variance <= 1e-12) return null

  const deviation = Math.sqrt(variance)
  const normalized = new Float64Array(values.length)
  for (let index = 0; index < values.length; index += 1) {
    normalized[index] = (values[index] - mean) / deviation
  }
  return normalized
}

function isValidValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value)
}

/**
 * Correlates a normalised selection with the window starting at `start`.
 * Returns null when the window contains a gap or is flat.
 */
function correlateWindow(
  values: ReadonlyArray<number | null | undefined>,
  start: number,
  length: number,
  normalizedSelection: Float64Array,
): number | null {
  const window: number[] = []
  for (let offset = 0; offset < length; offset += 1) {
    const value = values[start + offset]
    if (!isValidValue(value)) return null
    window.push(value)
  }

  const normalizedWindow = zNormalize(window)
  if (!normalizedWindow) return null

  let correlation = 0
  for (let offset = 0; offset < length; offset += 1) {
    correlation += normalizedSelection[offset] * normalizedWindow[offset]
  }
  return correlation / length
}

/**
 * Finds windows of the same length as the selected period where every supplied
 * series closely matches its selected shape. Each series is z-normalised
 * independently, so different scales and levels (for example an asset price and
 * VIX) do not prevent a match. The combined score is the minimum per-series
 * correlation, so a period that matches only one of the lines is rejected.
 */
export function findJointSimilarPatterns(
  series: ReadonlyArray<ReadonlyArray<number | null | undefined>>,
  startIndex: number,
  endIndex: number,
  options: PatternSearchOptions = {},
): JointPatternMatch[] {
  const threshold = Math.max(-1, Math.min(1, options.threshold ?? DEFAULT_PATTERN_THRESHOLD))
  const maxMatches = Math.max(1, Math.floor(options.maxMatches ?? 8))
  if (series.length === 0) return []

  const total = series[0].length
  if (series.some((values) => values.length !== total)) return []

  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) return []

  const from = Math.max(0, Math.min(startIndex, endIndex))
  const to = Math.min(total - 1, Math.max(startIndex, endIndex))
  const length = to - from + 1
  if (length < MIN_PATTERN_LENGTH) return []

  const normalizedSelections: Float64Array[] = []
  for (const values of series) {
    const selected: number[] = []
    for (let index = from; index <= to; index += 1) {
      const value = values[index]
      if (!isValidValue(value)) return []
      selected.push(value)
    }
    const normalizedSelection = zNormalize(selected)
    if (!normalizedSelection) return []
    normalizedSelections.push(normalizedSelection)
  }

  const candidates: JointPatternMatch[] = []
  const lastStart = total - length
  for (let candidateStart = 0; candidateStart <= lastStart; candidateStart += 1) {
    const candidateEnd = candidateStart + length - 1
    // Never compare the selected period against itself or overlapping windows.
    if (candidateStart <= to && candidateEnd >= from) continue

    const seriesScores: number[] = []
    let usable = true
    for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex += 1) {
      const correlation = correlateWindow(
        series[seriesIndex],
        candidateStart,
        length,
        normalizedSelections[seriesIndex],
      )
      if (correlation === null) {
        usable = false
        break
      }
      seriesScores.push(correlation)
    }
    if (!usable) continue

    // The weakest line decides, so both the asset and VIX shapes must match.
    const score = Math.min(...seriesScores)
    if (score >= threshold) {
      candidates.push({ startIndex: candidateStart, endIndex: candidateEnd, score, seriesScores })
    }
  }

  // Keep the best window from each cluster, and never return overlapping matches.
  candidates.sort((left, right) => right.score - left.score || left.startIndex - right.startIndex)
  const matches: JointPatternMatch[] = []
  for (const candidate of candidates) {
    if (matches.length >= maxMatches) break
    const overlaps = matches.some(
      (match) => candidate.startIndex <= match.endIndex && candidate.endIndex >= match.startIndex,
    )
    if (!overlaps) matches.push(candidate)
  }

  return matches.sort((left, right) => left.startIndex - right.startIndex)
}

/**
 * Finds windows of the same length as the selected period whose shape closely
 * matches it. Windows are z-normalised before comparison, so scale and level
 * differences do not prevent a match.
 */
export function findSimilarPatterns(
  values: ReadonlyArray<number | null | undefined>,
  startIndex: number,
  endIndex: number,
  options: PatternSearchOptions = {},
): PatternMatch[] {
  return findJointSimilarPatterns([values], startIndex, endIndex, options).map(
    ({ startIndex: matchStart, endIndex: matchEnd, score }) => ({
      startIndex: matchStart,
      endIndex: matchEnd,
      score,
    }),
  )
}
