import { describe, expect, it } from 'vitest'
import {
  getMagnificationWindow,
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
  it('maps 0 to the full timeline and 100 to maximum zoom', () => {
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

describe('getMagnificationWindow', () => {
  it('shows the full timeline when magnification is off', () => {
    expect(getMagnificationWindow(0)).toEqual({ start: 0, end: 100 })
  })

  it('shrinks the time window as magnification rises', () => {
    expect(getMagnificationWindow(50)).toEqual({ start: 50, end: 100 })
    expect(getMagnificationWindow(95)).toEqual({ start: 95, end: 100 })
  })

  it('keeps the latest data visible at every level', () => {
    for (const level of [0, 5, 25, 50, 75, 95, 100]) {
      expect(getMagnificationWindow(level).end).toBe(100)
    }
  })

  it('never collapses the window to zero', () => {
    expect(getMagnificationWindow(100)).toEqual({ start: 99, end: 100 })
  })
})
