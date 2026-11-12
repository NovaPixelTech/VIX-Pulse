import { useId } from 'react'
import { RotateCcw, ZoomIn } from 'lucide-react'
import {
  DEFAULT_MAGNIFICATION,
  MAGNIFY_MAX,
  MAGNIFY_MIN,
  MAGNIFY_STEP,
  magnificationToVisiblePercent,
  magnificationToZoomFactor,
  normalizeMagnification,
} from '@/lib/chartMagnify'

function formatZoomFactor(value: number): string {
  if (value >= 10) return `${Math.round(value)}×`
  return `${value.toFixed(1)}×`
}

export default function ChartMagnifySlider({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const id = useId()
  const descriptionId = `${id}-description`
  const normalized = normalizeMagnification(value)
  const visiblePercent = magnificationToVisiblePercent(normalized)
  const zoomFactor = magnificationToZoomFactor(normalized)
  const description =
    normalized === DEFAULT_MAGNIFICATION
      ? 'Off · full timeline'
      : `Latest ${visiblePercent}% of timeline · ${formatZoomFactor(zoomFactor)} zoom`

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <label
        htmlFor={id}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      >
        <ZoomIn className="h-4 w-4" aria-hidden="true" />
        Magnify
      </label>
      <input
        id={id}
        type="range"
        min={MAGNIFY_MIN}
        max={MAGNIFY_MAX}
        step={MAGNIFY_STEP}
        value={normalized}
        onChange={(event) => onChange(normalizeMagnification(Number(event.target.value)))}
        aria-valuetext={`${normalized} of 100 · ${description}`}
        aria-describedby={descriptionId}
        className="h-1.5 w-40 cursor-pointer accent-primary sm:w-56"
      />
      <span className="min-w-6 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
        {normalized}
      </span>
      <span id={descriptionId} className="text-xs text-muted-foreground">
        {description}
      </span>
      <button
        type="button"
        onClick={() => onChange(DEFAULT_MAGNIFICATION)}
        disabled={normalized === DEFAULT_MAGNIFICATION}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
        title="Reset magnification to the full timeline"
      >
        <RotateCcw className="h-3 w-3" aria-hidden="true" />
        Reset
      </button>
      <span className="text-[11px] text-muted-foreground/80">
        0 = full timeline · 100 = maximum (shared by all charts)
      </span>
    </div>
  )
}
