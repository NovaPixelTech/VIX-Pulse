interface BrushArea {
  coordRange?: ReadonlyArray<number | string>
}

interface BrushBatch {
  selected?: ReadonlyArray<{ dataIndex?: ReadonlyArray<number> }>
  areas?: ReadonlyArray<BrushArea>
}

interface BrushPayload {
  batch?: ReadonlyArray<BrushBatch>
  areas?: ReadonlyArray<BrushArea>
}

/**
 * Resolves the brushed start and end indices from an ECharts brush payload.
 *
 * Line series do not provide selected `dataIndex` values to the brush
 * component, so the area's `coordRange` (coordinates on the shared category
 * axis) is the reliable source. `brushSelected` nests areas under `batch`,
 * while `brushEnd` puts them at the top level.
 */
export function getBrushSelection(
  params: unknown,
  categories: ReadonlyArray<string>,
): { startIndex: number; endIndex: number } | null {
  if (categories.length === 0) return null
  const payload = params as BrushPayload | null | undefined
  if (!payload) return null

  const batches: ReadonlyArray<BrushBatch> = payload.batch?.length
    ? payload.batch
    : payload.areas?.length
      ? [{ areas: payload.areas }]
      : []
  if (batches.length === 0) return null

  const lastIndex = categories.length - 1
  const indices = new Set<number>()

  for (const batch of batches) {
    for (const entry of batch.selected ?? []) {
      for (const index of entry.dataIndex ?? []) {
        if (Number.isInteger(index) && index >= 0 && index <= lastIndex) indices.add(index)
      }
    }

    for (const area of batch.areas ?? []) {
      const range = area.coordRange
      if (!range || range.length < 2) continue

      const endpoints = range.slice(0, 2).map((value) => {
        if (typeof value === 'number') {
          return Number.isFinite(value) ? Math.round(value) : null
        }
        const position = categories.indexOf(value)
        return position >= 0 ? position : null
      })
      if (endpoints[0] === null || endpoints[1] === null) continue

      const from = Math.max(0, Math.min(endpoints[0], endpoints[1]))
      const to = Math.min(lastIndex, Math.max(endpoints[0], endpoints[1]))
      for (let index = from; index <= to; index += 1) indices.add(index)
    }
  }

  if (indices.size === 0) return null
  return { startIndex: Math.min(...indices), endIndex: Math.max(...indices) }
}
