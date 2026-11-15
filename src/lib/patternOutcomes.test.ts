import { describe, expect, it } from 'vitest'
import {
  computeForwardReturns,
  computePatternOutcomes,
  correlationUpperTailProbability,
  estimateFalseMatchRate,
} from './patternOutcomes'

describe('forward returns', () => {
  it('measures returns from the end of each matched window', () => {
    const values = [100, 110, 120, 90, 100]
    const [one, two] = computeForwardReturns(values, [0], [1, 2])
    expect(one.meanPct).toBeCloseTo(10, 6)
    expect(one.samples).toBe(1)
    expect(two.meanPct).toBeCloseTo(20, 6)
  })

  it('compares pattern outcomes with the unconditional baseline', () => {
    const values = [100, 110, 120, 90, 100, 105, 95]
    const summary = computePatternOutcomes(
      values,
      [
        { startIndex: 0, endIndex: 0, score: 1 },
        { startIndex: 1, endIndex: 1, score: 1 },
      ],
      [1],
    )

    expect(summary.pattern[0].samples).toBe(2)
    expect(summary.pattern[0].meanPct).toBeCloseTo(((110 / 100 - 1) * 100 + (120 / 110 - 1) * 100) / 2, 6)
    expect(summary.baseline[0].samples).toBe(6)
  })

  it('skips horizons that run past the series end', () => {
    const [result] = computeForwardReturns([100, 101, 102], [2], [5])
    expect(result.samples).toBe(0)
    expect(result.meanPct).toBeNull()
  })
})

describe('false-match estimate', () => {
  it('returns a one-sided p-value for a sample correlation', () => {
    expect(correlationUpperTailProbability(0, 10)).toBe(0.5)
    expect(correlationUpperTailProbability(0.9, 10)).toBeLessThan(0.01)
    expect(correlationUpperTailProbability(0.95, 10)).toBeLessThan(
      correlationUpperTailProbability(0.9, 10) as number,
    )
  })

  it('accounts for the pattern length and the number of candidate windows', () => {
    const short = estimateFalseMatchRate({
      threshold: 0.85,
      patternLength: 5,
      totalLength: 100,
      seriesCount: 2,
    })
    const long = estimateFalseMatchRate({
      threshold: 0.85,
      patternLength: 20,
      totalLength: 100,
      seriesCount: 2,
    })

    expect(short.singleWindowProbability).not.toBeNull()
    expect(short.singleWindowProbability!).toBeLessThan(short.perSeriesWindowProbability!)
    expect(short.atLeastOneProbability!).toBeGreaterThan(short.singleWindowProbability!)
    expect(long.singleWindowProbability!).toBeLessThan(short.singleWindowProbability!)
    expect(short.expectedFalseMatches).toBeGreaterThan(0)
  })
})
