import { ScanSearch, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const PATTERN_MATCH_COLOR = '#a21caf'
export const PATTERN_MATCH_DARK_COLOR = '#e879f9'
export const PATTERN_MATCH_BAND_COLOR = 'rgba(217, 70, 239, 0.16)'
export const PATTERN_SELECTION_COLOR = '#b45309'
export const PATTERN_SELECTION_DARK_COLOR = '#fbbf24'
export const PATTERN_SELECTION_BAND_COLOR = 'rgba(245, 158, 11, 0.14)'

const THRESHOLD_OPTIONS = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95]

const BUTTON_CLASS =
  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40'

export interface PatternSeriesOption {
  key: string
  label: string
}

export default function PatternSearchControls({
  seriesOptions,
  seriesKey,
  onSeriesChange,
  selecting,
  onToggleSelecting,
  selectionLabel,
  threshold,
  onThresholdChange,
  matchCount,
  onFindSimilar,
  onClear,
  message,
}: {
  seriesOptions: PatternSeriesOption[]
  seriesKey: string
  onSeriesChange: (key: string) => void
  selecting: boolean
  onToggleSelecting: () => void
  selectionLabel: string | null
  threshold: number
  onThresholdChange: (value: number) => void
  matchCount: number
  onFindSimilar: () => void
  onClear: () => void
  message: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ScanSearch className="h-4 w-4" aria-hidden="true" />
          Pattern search
        </span>

        {seriesOptions.length > 1 && (
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            Series
            <select
              value={seriesKey}
              onChange={(event) => onSeriesChange(event.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {seriesOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          onClick={onToggleSelecting}
          aria-pressed={selecting}
          className={cn(
            BUTTON_CLASS,
            selecting
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />
          {selecting ? 'Drag on chart…' : 'Select region'}
        </button>

        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          Min match
          <select
            value={threshold}
            onChange={(event) => onThresholdChange(Number(event.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {THRESHOLD_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {Math.round(value * 100)}%
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onFindSimilar}
          disabled={!selectionLabel}
          className={cn(
            BUTTON_CLASS,
            'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Find similar
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={!selectionLabel && matchCount === 0}
          className={cn(
            BUTTON_CLASS,
            'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>

        {selectionLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-muted-foreground">
            <span
              className="h-2.5 w-4 rounded-sm"
              style={{ backgroundColor: PATTERN_SELECTION_COLOR }}
              aria-hidden="true"
            />
            {selectionLabel}
          </span>
        )}

        {matchCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="h-2.5 w-4 rounded-sm"
              style={{ backgroundColor: PATTERN_MATCH_COLOR }}
              aria-hidden="true"
            />
            {matchCount} {matchCount === 1 ? 'match' : 'matches'} highlighted
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {message}
      </p>
    </div>
  )
}
