import type { PatternMatch } from '@/lib/patternMatch'

export const DEFAULT_PATTERN_HORIZONS = [5, 10, 20, 60]

export interface ForwardReturnHorizon {
  horizon: number
  samples: number
  meanPct: number | null
  medianPct: number | null
  stdevPct: number | null
  winRatePct: number | null
  minPct: number | null
  maxPct: number | null
}

export interface PatternOutcomeSummary {
  pattern: ForwardReturnHorizon[]
  baseline: ForwardReturnHorizon[]
}

export interface FalseMatchEstimate {
  /** Probability that one random window matches every supplied series. */
  singleWindowProbability: number | null
  /** Probability for a single series before the joint-series adjustment. */
  perSeriesWindowProbability: number | null
  candidateWindows: number
  seriesCount: number
  expectedFalseMatches: number | null
  /** Approximate chance of at least one false match anywhere in the search. */
  atLeastOneProbability: number | null
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function stdev(values: number[]): number | null {
  if (values.length < 2) return null
  const average = mean(values) as number
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function summarizeHorizon(horizon: number, returns: number[]): ForwardReturnHorizon {
  return {
    horizon,
    samples: returns.length,
    meanPct: mean(returns),
    medianPct: median(returns),
    stdevPct: stdev(returns),
    winRatePct:
      returns.length > 0 ? (returns.filter((value) => value > 0).length / returns.length) * 100 : null,
    minPct: returns.length > 0 ? Math.min(...returns) : null,
    maxPct: returns.length > 0 ? Math.max(...returns) : null,
  }
}

function forwardReturn(
  values: ReadonlyArray<number | null | undefined>,
  startIndex: number,
  horizon: number,
): number | null {
  const endIndex = startIndex + horizon
  if (startIndex < 0 || endIndex >= values.length) return null
  const start = values[startIndex]
  const end = values[endIndex]
  if (!isFiniteNumber(start) || !isFiniteNumber(end) || start <= 0) return null
  return (end / start - 1) * 100
}

export function computeForwardReturns(
  values: ReadonlyArray<number | null | undefined>,
  endIndices: number[],
  horizons: number[],
): ForwardReturnHorizon[] {
  const uniqueEnds = [...new Set(endIndices)].filter(
    (index) => Number.isInteger(index) && index >= 0 && index < values.length,
  )
  return horizons.map((horizon) => {
    const returns = uniqueEnds.flatMap((endIndex) => {
      const value = forwardReturn(values, endIndex, horizon)
      return value === null ? [] : [value]
    })
    return summarizeHorizon(horizon, returns)
  })
}

export function computeBaselineForwardReturns(
  values: ReadonlyArray<number | null | undefined>,
  horizons: number[],
): ForwardReturnHorizon[] {
  const indices = values.map((_, index) => index)
  return computeForwardReturns(values, indices, horizons)
}

export function computePatternOutcomes(
  values: ReadonlyArray<number | null | undefined>,
  matches: PatternMatch[],
  horizons: number[] = DEFAULT_PATTERN_HORIZONS,
): PatternOutcomeSummary {
  return {
    pattern: computeForwardReturns(
      values,
      matches.map((match) => match.endIndex),
      horizons,
    ),
    baseline: computeBaselineForwardReturns(values, horizons),
  }
}

const LANCZOS_COEFFICIENTS = [
  // Published Lanczos coefficients; the literal is rounded to the nearest double.
  // eslint-disable-next-line no-loss-of-precision
  76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2,
  -0.5395239384953e-5,
]

function logGamma(value: number): number {
  let x = value
  let y = value
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let series = 1 + 1.90015e-10
  for (let index = 0; index < LANCZOS_COEFFICIENTS.length; index += 1) {
    y += 1
    series += LANCZOS_COEFFICIENTS[index] / y
  }
  return -tmp + Math.log((Math.sqrt(2 * Math.PI) * series) / x)
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const maxIterations = 200
  const epsilon = 3e-14
  const tiny = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < tiny) d = tiny
  d = 1 / d
  let h = d

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const m2 = 2 * iteration
    let aa = (iteration * (b - iteration) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    h *= d * c

    aa = (-(a + iteration) * (qab + iteration) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < epsilon) break
  }
  return h
}

function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const beta = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) {
    return (beta * betaContinuedFraction(a, b, x)) / a
  }
  return 1 - (beta * betaContinuedFraction(b, a, 1 - x)) / b
}

function studentTUpperTail(t: number, degreesOfFreedom: number): number {
  if (!Number.isFinite(t)) return 0
  if (t <= 0) return 0.5
  const x = degreesOfFreedom / (degreesOfFreedom + t * t)
  return 0.5 * regularizedIncompleteBeta(degreesOfFreedom / 2, 0.5, x)
}

/**
 * One-sided probability that a random window of length `sampleSize` has a
 * Pearson correlation at least as high as `correlation`, under the null of no
 * relationship. This is the usual t approximation for a sample correlation.
 */
export function correlationUpperTailProbability(correlation: number, sampleSize: number): number | null {
  if (sampleSize < 3 || !Number.isFinite(correlation)) return null
  if (correlation <= 0) return 0.5
  if (correlation >= 1) return 0
  const degreesOfFreedom = sampleSize - 2
  const t = correlation * Math.sqrt(degreesOfFreedom / (1 - correlation * correlation))
  return studentTUpperTail(t, degreesOfFreedom)
}

/**
 * Approximate multiple-comparison estimate for a pattern search. Candidate
 * windows overlap, so `atLeastOneProbability` is an illustrative upper bound,
 * not an exact family-wise error rate.
 */
export function estimateFalseMatchRate({
  threshold,
  patternLength,
  totalLength,
  seriesCount = 1,
}: {
  threshold: number
  patternLength: number
  totalLength: number
  seriesCount?: number
}): FalseMatchEstimate {
  const candidateWindows = Math.max(0, totalLength - patternLength + 1)
  const perSeries = correlationUpperTailProbability(threshold, patternLength)
  if (perSeries === null || candidateWindows === 0) {
    return {
      singleWindowProbability: null,
      perSeriesWindowProbability: perSeries,
      candidateWindows,
      seriesCount,
      expectedFalseMatches: null,
      atLeastOneProbability: null,
    }
  }
  const singleWindow = Math.min(1, perSeries ** Math.max(1, seriesCount))
  return {
    singleWindowProbability: singleWindow,
    perSeriesWindowProbability: perSeries,
    candidateWindows,
    seriesCount,
    expectedFalseMatches: singleWindow * candidateWindows,
    atLeastOneProbability: 1 - (1 - singleWindow) ** candidateWindows,
  }
}
