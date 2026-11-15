import { useMemo } from 'react'
import { AlertTriangle, FlaskConical } from 'lucide-react'
import type { PatternMatch } from '@/lib/patternMatch'
import {
  computePatternOutcomes,
  estimateFalseMatchRate,
  type ForwardReturnHorizon,
} from '@/lib/patternOutcomes'
import { formatNumber, formatPercent } from '@/lib/utils'

function returnClass(value: number | null): string {
  if (value === null) return 'text-muted-foreground'
  return value >= 0 ? 'text-success' : 'text-destructive'
}

function HorizonRow({
  pattern,
  baseline,
  periodLabel,
}: {
  pattern: ForwardReturnHorizon
  baseline: ForwardReturnHorizon
  periodLabel: string
}) {
  const edge =
    pattern.meanPct !== null && baseline.meanPct !== null ? pattern.meanPct - baseline.meanPct : null
  return (
    <tr className="border-t border-border">
      <td className="p-3 font-mono text-sm">
        +{pattern.horizon} {periodLabel}
      </td>
      <td className="p-3 text-right font-mono text-sm text-muted-foreground">{pattern.samples}</td>
      <td className={`p-3 text-right font-mono text-sm font-semibold ${returnClass(pattern.meanPct)}`}>
        {formatPercent(pattern.meanPct)}
      </td>
      <td className={`p-3 text-right font-mono text-sm ${returnClass(pattern.medianPct)}`}>
        {formatPercent(pattern.medianPct)}
      </td>
      <td className="p-3 text-right font-mono text-sm">{formatNumber(pattern.winRatePct, 0)}%</td>
      <td className={`p-3 text-right font-mono text-sm ${returnClass(baseline.meanPct)}`}>
        {formatPercent(baseline.meanPct)}
      </td>
      <td className={`p-3 text-right font-mono text-sm font-semibold ${returnClass(edge)}`}>
        {formatPercent(edge)}
      </td>
    </tr>
  )
}

export default function PatternOutcomePanel({
  values,
  matches,
  threshold,
  seriesCount = 2,
  periodLabel = 'sessions',
  assetLabel,
}: {
  values: ReadonlyArray<number | null | undefined>
  matches: PatternMatch[]
  threshold: number
  seriesCount?: number
  periodLabel?: 'sessions' | 'weeks'
  assetLabel: string
}) {
  const horizons = useMemo(() => (periodLabel === 'weeks' ? [2, 4, 8, 12] : [5, 10, 20, 60]), [periodLabel])
  const outcomes = useMemo(
    () => computePatternOutcomes(values, matches, horizons),
    [values, matches, horizons],
  )
  const patternLength = matches.length > 0 ? matches[0].endIndex - matches[0].startIndex + 1 : 0
  const falseMatch = useMemo(
    () =>
      patternLength > 0
        ? estimateFalseMatchRate({
            threshold,
            patternLength,
            totalLength: values.length,
            seriesCount,
          })
        : null,
    [patternLength, threshold, values.length, seriesCount],
  )

  if (matches.length === 0) return null

  const limitedSample = matches.length < 5

  return (
    <section
      className="rounded-xl border border-border bg-card p-4 sm:p-5 card-glow space-y-3"
      aria-label={`Forward outcomes after similar ${assetLabel} and VIX patterns`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <FlaskConical className="h-4 w-4 text-primary" aria-hidden="true" />
            What happened after past matches
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Forward return from the close at the end of each matched window to the close {periodLabel} later,
            compared with every eligible window in the same chart. This is the first test of whether the
            pattern carried information; it is not a trade simulation.
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
          {matches.length} {matches.length === 1 ? 'match' : 'matches'} · {patternLength} {periodLabel}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Horizon</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">Matches</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">Pattern mean</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">Pattern median</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">Win rate</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">Baseline mean</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">Pattern − baseline</th>
            </tr>
          </thead>
          <tbody>
            {outcomes.pattern.map((pattern, index) => (
              <HorizonRow
                key={pattern.horizon}
                pattern={pattern}
                baseline={outcomes.baseline[index]}
                periodLabel={periodLabel}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <p>
          {limitedSample
            ? 'Fewer than five matches: the mean is fragile, and a single outlier can dominate the result. Treat it as an anecdote, not an edge.'
            : 'Even with several matches, overlapping windows and shared market regimes make the samples less independent than the count suggests.'}
        </p>
        {falseMatch ? (
          <p className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
            <span>
              Approximate search noise: at ≥{Math.round(threshold * 100)}% correlation with {patternLength}{' '}
              {periodLabel}, one random window has about a{' '}
              {formatNumber((falseMatch.singleWindowProbability ?? 0) * 100, 1)}% chance of matching both
              lines. Across {falseMatch.candidateWindows} candidate windows, the chance of at least one false
              match is roughly {formatNumber((falseMatch.atLeastOneProbability ?? 0) * 100, 0)}%.
            </span>
          </p>
        ) : null}
      </div>
    </section>
  )
}
