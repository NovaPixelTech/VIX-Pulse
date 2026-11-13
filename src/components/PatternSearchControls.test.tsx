import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import PatternSearchControls, { PATTERN_MATCH_COLOR } from './PatternSearchControls'

// Rendering with createRoot/act requires the React act environment flag.
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const baseProps = {
  seriesOptions: [{ key: 'asset', label: 'AAPL' }],
  seriesKey: 'asset',
  onSeriesChange: () => {},
  selecting: false,
  onToggleSelecting: () => {},
  selectionLabel: null as string | null,
  threshold: 0.85,
  onThresholdChange: () => {},
  matchCount: 0,
  onFindSimilar: () => {},
  onClear: () => {},
  message: 'Select a region on the chart, then click Find similar.',
}

describe('PatternSearchControls', () => {
  let container: HTMLElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const render = (overrides: Partial<typeof baseProps> = {}) => {
    act(() => {
      root.render(<PatternSearchControls {...baseProps} {...overrides} />)
    })
  }

  const button = (label: string) =>
    Array.from(container.querySelectorAll('button')).find((element) =>
      element.textContent?.includes(label),
    ) as HTMLButtonElement | undefined

  const thresholdSelect = () =>
    Array.from(container.querySelectorAll('select')).find(
      (element) => element.options[0]?.value === '0.7',
    ) as HTMLSelectElement

  it('requires a selection before Find similar can run', () => {
    render()

    expect(button('Find similar')?.disabled).toBe(true)
    expect(button('Clear')?.disabled).toBe(true)
    // Only the threshold picker is shown when there is a single series.
    expect(container.querySelectorAll('select')).toHaveLength(1)
    expect(container.textContent).toContain(baseProps.message)
  })

  it('enables matching and clearing once a region is selected', () => {
    const onFindSimilar = vi.fn()
    const onClear = vi.fn()
    render({
      selectionLabel: '01.01.2026 – 01.03.2026 · 9 periods',
      onFindSimilar,
      onClear,
    })

    expect(container.textContent).toContain('01.01.2026 – 01.03.2026 · 9 periods')
    const findButton = button('Find similar')
    const clearButton = button('Clear')
    expect(findButton?.disabled).toBe(false)
    expect(clearButton?.disabled).toBe(false)

    act(() => {
      findButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      clearButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onFindSimilar).toHaveBeenCalledTimes(1)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('lists every pair option and reports pair changes', () => {
    const onSeriesChange = vi.fn()
    render({
      seriesOptions: [
        { key: 'asset', label: 'AAPL' },
        { key: 'vix', label: 'VIX' },
      ],
      onSeriesChange,
    })

    const select = container.querySelector('select') as HTMLSelectElement
    expect(select).not.toBeNull()
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['AAPL', 'VIX'])

    select.value = 'vix'
    act(() => {
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onSeriesChange).toHaveBeenCalledWith('vix')
  })

  it('reports the threshold as a number', () => {
    const onThresholdChange = vi.fn()
    render({ onThresholdChange })

    const threshold = thresholdSelect()
    expect(threshold.value).toBe('0.85')

    threshold.value = '0.9'
    act(() => {
      threshold.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onThresholdChange).toHaveBeenCalledWith(0.9)
  })

  it('shows the drag state while selecting', () => {
    const onToggleSelecting = vi.fn()
    render({ selecting: true, onToggleSelecting })

    const selectButton = button('Drag on chart')
    expect(selectButton).toBeDefined()
    expect(selectButton?.getAttribute('aria-pressed')).toBe('true')

    act(() => {
      selectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onToggleSelecting).toHaveBeenCalledTimes(1)
  })

  it('summarises the highlighted match count with the match colour', () => {
    render({ matchCount: 3, selectionLabel: '01.01.2026 – 01.03.2026 · 9 periods' })

    expect(container.textContent).toContain('3 matches highlighted')
    const matchSwatch = Array.from(container.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')).find(
      (element) => element.style.backgroundColor === 'rgb(162, 28, 175)',
    )
    expect(matchSwatch).toBeDefined()
    expect(PATTERN_MATCH_COLOR).toBe('#a21caf')
  })
})
