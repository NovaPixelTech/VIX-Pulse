import { describe, expect, it } from 'vitest'
import { findSimilarPatterns, MIN_PATTERN_LENGTH } from './patternMatch'

const PATTERN = [1, 3, 2, 5, 4, 6]
const FILLER = [9, 12, 8, 14, 10, 15, 11, 13]

function overlaps(
  left: { startIndex: number; endIndex: number },
  right: { startIndex: number; endIndex: number },
) {
  return left.startIndex <= right.endIndex && left.endIndex >= right.startIndex
}

describe('findSimilarPatterns', () => {
  it('finds an exact repeat elsewhere in the chart', () => {
    const values = [...PATTERN, ...FILLER, ...PATTERN]
    const matches = findSimilarPatterns(values, 0, PATTERN.length - 1, { threshold: 0.999 })

    const repeat = matches.find((match) => match.startIndex === PATTERN.length + FILLER.length)
    expect(repeat).toBeDefined()
    expect(repeat?.endIndex).toBe(values.length - 1)
    expect(repeat?.score).toBeGreaterThan(0.999)
  })

  it('matches a scaled and shifted copy of the shape', () => {
    const shifted = PATTERN.map((value) => value * 3 + 7)
    const values = [...PATTERN, ...FILLER, ...shifted]
    const matches = findSimilarPatterns(values, 0, PATTERN.length - 1, { threshold: 0.999 })

    expect(matches.some((match) => match.startIndex === PATTERN.length + FILLER.length)).toBe(true)
  })

  it('never returns the selected region or windows overlapping it', () => {
    const values = [...PATTERN, ...FILLER, ...PATTERN]
    const selection = { startIndex: 0, endIndex: PATTERN.length - 1 }
    const matches = findSimilarPatterns(values, selection.startIndex, selection.endIndex, {
      threshold: 0.5,
    })

    expect(matches.every((match) => !overlaps(selection, match))).toBe(true)
  })

  it('returns non-overlapping matches only', () => {
    const values = [...PATTERN, ...FILLER, ...PATTERN, ...FILLER, ...PATTERN, ...FILLER, ...PATTERN]
    const matches = findSimilarPatterns(values, 0, PATTERN.length - 1, { threshold: 0.5 })

    for (let index = 0; index < matches.length; index += 1) {
      for (let other = index + 1; other < matches.length; other += 1) {
        expect(overlaps(matches[index], matches[other])).toBe(false)
      }
    }
  })

  it('honours the maxMatches limit', () => {
    const values = [...PATTERN, ...FILLER, ...PATTERN, ...FILLER, ...PATTERN, ...FILLER, ...PATTERN]
    const matches = findSimilarPatterns(values, 0, PATTERN.length - 1, {
      threshold: 0.5,
      maxMatches: 2,
    })

    expect(matches).toHaveLength(2)
  })

  it('skips candidate windows containing missing values', () => {
    const values = [...PATTERN, 9, null, 8, 14, 10, 15, 11, 13, ...PATTERN]
    const matches = findSimilarPatterns(values, 0, PATTERN.length - 1, { threshold: 0.999 })

    expect(matches.some((match) => match.startIndex === values.length - PATTERN.length)).toBe(true)
    expect(matches.every((match) => !(match.startIndex <= 7 && match.endIndex >= 7))).toBe(true)
  })

  it('returns nothing for flat, too-short, or invalid selections', () => {
    expect(findSimilarPatterns([5, 5, 5, 5, 5, 5], 0, 4)).toEqual([])
    expect(findSimilarPatterns(PATTERN, 0, MIN_PATTERN_LENGTH - 2)).toEqual([])
    expect(findSimilarPatterns(PATTERN, Number.NaN, 2)).toEqual([])
    const repeated = [...PATTERN, ...FILLER, ...PATTERN]
    expect(findSimilarPatterns(repeated, PATTERN.length - 1, 0, { threshold: 0.999 })).not.toHaveLength(0)
  })

  it('clamps out-of-range selections to the data bounds', () => {
    const values = [...PATTERN, ...FILLER, ...PATTERN]
    const matches = findSimilarPatterns(values, -10, 900, { threshold: 0.999 })

    // The clamped selection covers the whole chart, so there is nothing left to compare.
    expect(matches).toEqual([])
  })
})
