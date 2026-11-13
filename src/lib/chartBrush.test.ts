import { describe, expect, it } from 'vitest'
import { getBrushSelection } from './chartBrush'

const categories = ['2026-01-02', '2026-01-09', '2026-01-16', '2026-01-23', '2026-01-30', '2026-02-06']

describe('getBrushSelection', () => {
  it('reads an interactive brushEnd payload with numeric category coordinates', () => {
    // Interactive lineX brushing converts pixels to fractional category indices.
    const selection = getBrushSelection({ type: 'brushEnd', areas: [{ coordRange: [1.4, 4.2] }] }, categories)

    expect(selection).toEqual({ startIndex: 1, endIndex: 4 })
  })

  it('reads category labels from a coordRange', () => {
    const selection = getBrushSelection(
      {
        batch: [
          {
            areas: [{ coordRange: ['2026-01-09', '2026-01-30'] }],
          },
        ],
      },
      categories,
    )

    expect(selection).toEqual({ startIndex: 1, endIndex: 4 })
  })

  it('handles reversed ranges and clamps to the data bounds', () => {
    const selection = getBrushSelection({ areas: [{ coordRange: [-3, 1.8] }] }, categories)

    expect(selection).toEqual({ startIndex: 0, endIndex: 2 })
  })

  it('falls back to selected data indices when a series reports them', () => {
    const selection = getBrushSelection({ batch: [{ selected: [{ dataIndex: [2, 3, 4, 99] }] }] }, categories)

    expect(selection).toEqual({ startIndex: 2, endIndex: 4 })
  })

  it('returns null for empty, missing, or unusable payloads', () => {
    expect(getBrushSelection(null, categories)).toBeNull()
    expect(getBrushSelection({}, categories)).toBeNull()
    expect(getBrushSelection({ areas: [] }, categories)).toBeNull()
    expect(getBrushSelection({ areas: [{ coordRange: [1, 4] }] }, [])).toBeNull()
    expect(getBrushSelection({ areas: [{ coordRange: [NaN, 4] }] }, categories)).toBeNull()
    expect(getBrushSelection({ areas: [{ coordRange: ['nope', '2026-01-30'] }] }, categories)).toBeNull()
  })
})
