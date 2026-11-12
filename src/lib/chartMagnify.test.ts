import { describe, expect, it } from 'vitest'
import {
  getMagnifiedAxisRange,
  magnificationToVisiblePercent,
  magnificationToZoomFactor,
  normalizeMagnification,
} from './chartMagnify'

describe('normalizeMagnification', () => {
  it('keeps values on the 5-point scale', () => {
    expect(normalizeMagnification(0)).toBe(0)
    expect(normalizeMagnification(7)).toBe(5)
    expect(normalizeMagnification(8)).toBe(10)
    expect(normalizeMagnification(100)).toBe(100)
  })

  it('clamps out-of-range and invalid values', () => {
    expect(normalizeMagnification(-20)).toBe(0)
    expect(normalizeMagnification(140)).toBe(100)
    expect(normalizeMagnification(Number.NaN)).toBe(0)
  })
})

describe('magnification scale', () => {
  it('maps 0 to the full range and 100 to maximum zoom', () => {
    expect(magnificationToVisiblePercent(0)).toBe(100)
    expect(magnificationToVisiblePercent(50)).toBe(50)
    expect(magnificationToVisiblePercent(100)).toBe(1)
  })

  it('reports the matching zoom factor', () => {
    expect(magnificationToZoomFactor(0)).toBe(1)
    expect(magnificationToZoomFactor(50)).toBe(2)
    expect(magnificationToZoomFactor(100)).toBe(100)
  })
})

describe('getMagnifiedAxisRange', () => {
  it('returns no explicit bounds when magnification is off', () => {
    expect(getMagnifiedAxisRange([10, 20], 0)).toEqual({})
  })

  it('zooms around the midpoint of the data', () => {
    const range = getMagnifiedAxisRange([10, 20], 50)
    expect(range.min).toBeCloseTo(12.4)
    expect(range.max).toBeCloseTo(17.6)
  })

  it('narrows the window as magnification rises', () => {
    const halfRange = getMagnifiedAxisRange([10, 20], 50)
    const fullMagnification = getMagnifiedAxisRange([10, 20], 100)
    expect((fullMagnification.max ?? 0) - (fullMagnification.min ?? 0)).toBeLessThan(
      (halfRange.max ?? 0) - (halfRange.min ?? 0),
    )
    expect(fullMagnification.min).toBeGreaterThan(14.9)
    expect(fullMagnification.max).toBeLessThan(15.1)
  })

  it('ignores missing values and handles flat series', () => {
    expect(getMagnifiedAxisRange([null, 5, undefined, Number.NaN, 5], 50)).toEqual({})
    expect(getMagnifiedAxisRange([null, undefined], 50)).toEqual({})
  })
})
