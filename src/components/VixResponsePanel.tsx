import { Fragment } from 'react'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/utils'
import type { AssetVixResponse, VixResponseStatKey } from '@/lib/vixResponse'

type SummaryUnit = 'vix' | 'currency' | 'points' | 'percent' | 'magnitudePercent' | 'ratio' | 'days'

interface SummaryRow {
  label: string
  key: VixResponseStatKey
  unit: SummaryUnit
}

const SUMMARY_ROWS: Array<{ group: string; rows: SummaryRow[] }> = [
  {
    group: 'VIX and prices',
    rows: [
      { label: 'VIX at peak', key: 'peakVix', unit: 'vix' },
      { label: 'VIX rise from baseline', key: 'vixRisePoints', unit: 'points' },
      { label: 'VIX rise from baseline', key: 'vixRisePct', unit: 'percent' },
      { label: 'Asset baseline close', key: 'baselinePrice', unit: 'currency' },
      { label: 'Asset price at peak', key: 'peakPrice', unit: 'currency' },
      { label: 'Asset price at VIX recovery', key: 'recoveryPrice', unit: 'currency' },
    ],
  },
  {
    group: 'Price response and duration',
    rows: [
      { label: 'Stress-period price move', key: 'stressChangePct', unit: 'percent' },
      { label: 'Peak drawdown depth', key: 'drawdownPct', unit: 'magnitudePercent' },
      { label: 'Response ratio (% per VIX point)', key: 'responseRatio', unit: 'ratio' },
      { label: 'Peak-to-recovery rebound', key: 'reboundPct', unit: 'percent' },
      { label: 'Baseline-to-recovery return (P/L)', key: 'cycleReturnPct', unit: 'percent' },
      { label: 'Days until VIX recovery', key: 'daysToVixRecovery', unit: 'days' },
      { label: 'Days until asset regains baseline', key: 'daysToBaselineRecovery', unit: 'days' },
    ],
  },
  {
    group: 'Moving averages at peak',
    rows: [
      { label: '4-week moving average', key: 'fourWeekMaAtPeak', unit: 'currency' },
      { label: 'Price vs 4-week average', key: 'priceVsFourWeekMaAtPeakPct', unit: 'percent' },
      { label: '13-week moving average', key: 'thirteenWeekMaAtPeak', unit: 'currency' },
      { label: 'Price vs 13-week average', key: 'priceVsThirteenWeekMaAtPeakPct', unit: 'percent' },
    ],
  },
  {
    group: 'Moving averages at VIX recovery',
    rows: [
      { label: '4-week moving average', key: 'fourWeekMaAtRecovery', unit: 'currency' },
      { label: 'Price vs 4-week average', key: 'priceVsFourWeekMaAtRecoveryPct', unit: 'percent' },
      { label: '13-week moving average', key: 'thirteenWeekMaAtRecovery', unit: 'currency' },
      { label: 'Price vs 13-week average', key: 'priceVsThirteenWeekMaAtRecoveryPct', unit: 'percent' },
    ],
  },
]

function formatSummaryValue(value: number | null, unit: SummaryUnit, currency: string): string {
  if (value === null) return '—'
  switch (unit) {
    case 'vix':
    case 'points':
      return formatNumber(value, 2)
    case 'currency':
      return formatCurrency(value, currency)
    case 'percent':
      return formatPercent(value)
    case 'magnitudePercent':
      return `${formatNumber(value)}%`
    case 'ratio':
      return `${formatNumber(value, 3)}% / VIX pt`
    case 'days':
      return formatNumber(value, 0)
  }
}

function formatRate(value: number | null): string {
  return value === null ? '—' : `${formatNumber(value, 1)}%`
}

function formatMovingAverage(value: number | null, distance: number | null, currency: string) {
  return (
    <>
      <span>{formatCurrency(value, currency)}</span>
      <span className="block text-xs text-muted-foreground">{formatPercent(distance)} vs MA</span>
    </>
  )
}

function signedColor(value: number | null): string {
  if (value === null) return 'text-muted-foreground'
  return value >= 0 ? 'text-success' : 'text-destructive'
}

export default function VixResponsePanel({
  response,
  currency,
}: {
  response: AssetVixResponse
  currency: string
}) {
  return (
    <section className="space-y-6" aria-labelledby="vix-response-heading">
      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="vix-response-heading" className="text-2xl font-bold">
            VIX &gt;25 Response Analysis
          </h2>
          <p className="text-sm text-muted-foreground">
            {response.eventCount} local peaks · {response.cycleCount} grouped recovery cycles ·{' '}
            {response.recoveredCycleCount} recovered
          </p>
        </div>
        <p className="max-w-5xl text-sm text-muted-foreground">
          Each cycle contributes its highest VIX peak to the summary so repeated local highs do not overweight
          one episode. The event table retains every peak above 25. Stress move compares the peak price with
          the last weekly close before that peak; rebound compares the recovery price with the peak price.
          Response ratio is the stress-period asset move per VIX point.
        </p>
      </div>

      {response.eventCount === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          No VIX peaks above 25 are available for this asset.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Positive rebound cycles</p>
              <p className="mt-1 font-mono text-xl font-bold">
                {formatRate(response.positiveRecoveryRatePct)}
              </p>
              <p className="text-xs text-muted-foreground">
                {response.positiveRecoveryCount} of {response.recoveredCycleCount} recovered cycles
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Regained pre-peak baseline</p>
              <p className="mt-1 font-mono text-xl font-bold">
                {formatRate(response.baselineRecoveryRatePct)}
              </p>
              <p className="text-xs text-muted-foreground">Among cycles with a peak drawdown</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Representative VIX peaks</p>
              <p className="mt-1 font-mono text-xl font-bold">{response.cycleCount}</p>
              <p className="text-xs text-muted-foreground">
                Highest local peak counted once per recovery window
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card card-glow">
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full min-w-[760px]">
                <caption className="sr-only">
                  Minimum, average, and maximum VIX response metrics across grouped recovery cycles
                </caption>
                <thead className="sticky top-0 z-10 bg-card">
                  <tr>
                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Metric</th>
                    <th className="p-3 text-right text-sm font-medium text-muted-foreground">Lowest</th>
                    <th className="p-3 text-right text-sm font-medium text-muted-foreground">Average</th>
                    <th className="p-3 text-right text-sm font-medium text-muted-foreground">Highest</th>
                  </tr>
                </thead>
                <tbody>
                  {SUMMARY_ROWS.map(({ group, rows }) => (
                    <Fragment key={group}>
                      <tr key={`${group}-heading`} className="border-t border-border bg-muted/40">
                        <th
                          colSpan={4}
                          className="p-3 text-left text-xs font-semibold uppercase tracking-wide"
                        >
                          {group}
                        </th>
                      </tr>
                      {rows.map(({ label, key, unit }) => {
                        const summary = response.stats[key]
                        return (
                          <tr key={`${group}-${key}`} className="border-t border-border/70">
                            <th scope="row" className="p-3 text-left text-sm font-medium">
                              {label}
                            </th>
                            <td className="p-3 text-right font-mono text-sm text-muted-foreground">
                              {formatSummaryValue(summary.min, unit, currency)}
                            </td>
                            <td className="p-3 text-right font-mono text-sm font-semibold">
                              {formatSummaryValue(summary.average, unit, currency)}
                            </td>
                            <td className="p-3 text-right font-mono text-sm text-muted-foreground">
                              {formatSummaryValue(summary.max, unit, currency)}
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-xl font-bold">All individual VIX peaks above 25</h3>
              <p className="text-xs text-muted-foreground">Newest first · scroll within the table</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card card-glow">
              <div className="max-h-[40rem] overflow-auto">
                <table className="w-full min-w-[2460px]">
                  <caption className="sr-only">
                    Per-peak VIX and asset response, recovery, and moving-average metrics
                  </caption>
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr>
                      {[
                        ['Peak date', 'left'],
                        ['VIX peak', 'right'],
                        ['Baseline close', 'right'],
                        ['Price at peak', 'right'],
                        ['VIX rise', 'right'],
                        ['Stress move', 'right'],
                        ['Response ratio', 'right'],
                        ['VIX recovery', 'left'],
                        ['Recovery price', 'right'],
                        ['Rebound', 'right'],
                        ['Cycle P/L', 'right'],
                        ['VIX days', 'right'],
                        ['Days to baseline', 'right'],
                        ['4W MA at peak', 'right'],
                        ['13W MA at peak', 'right'],
                        ['4W MA at recovery', 'right'],
                        ['13W MA at recovery', 'right'],
                      ].map(([label, align]) => (
                        <th
                          key={label}
                          className={`p-3 ${align === 'left' ? 'text-left' : 'text-right'} text-xs font-medium text-muted-foreground`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...response.events].reverse().map((event, index) => (
                      <tr key={`${event.peakDate}-${index}`} className="border-t border-border">
                        <td className="p-3 font-mono text-sm">{formatDate(event.peakDate)}</td>
                        <td className="p-3 text-right font-mono text-sm font-semibold text-red-600 dark:text-red-400">
                          {formatNumber(event.peakVix, 2)}
                        </td>
                        <td className="p-3 text-right font-mono text-sm">
                          {formatCurrency(event.baselinePrice, currency)}
                          <span className="block text-xs text-muted-foreground">
                            {event.baselineDate ? formatDate(event.baselineDate) : 'No prior close'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-sm">
                          {formatCurrency(event.peakPrice, currency)}
                        </td>
                        <td className="p-3 text-right font-mono text-sm">
                          {event.vixRisePoints === null ? '—' : `${formatNumber(event.vixRisePoints, 2)} pts`}
                          <span className="block text-xs text-muted-foreground">
                            {formatPercent(event.vixRisePct)}
                          </span>
                        </td>
                        <td
                          className={`p-3 text-right font-mono text-sm ${signedColor(event.stressChangePct)}`}
                        >
                          {formatPercent(event.stressChangePct)}
                        </td>
                        <td className="p-3 text-right font-mono text-sm">
                          {event.responseRatio === null
                            ? '—'
                            : `${formatNumber(event.responseRatio, 3)}% / pt`}
                        </td>
                        <td className="p-3 font-mono text-sm">
                          {event.recoveryDate ? formatDate(event.recoveryDate) : 'Pending'}
                          {event.recoveryVix !== null && (
                            <span className="block text-xs text-muted-foreground">
                              weekly VIX {formatNumber(event.recoveryVix, 2)}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono text-sm">
                          {formatCurrency(event.recoveryPrice, currency)}
                        </td>
                        <td
                          className={`p-3 text-right font-mono text-sm font-semibold ${signedColor(event.reboundPct)}`}
                        >
                          {formatPercent(event.reboundPct)}
                        </td>
                        <td
                          className={`p-3 text-right font-mono text-sm font-semibold ${signedColor(event.cycleReturnPct)}`}
                        >
                          {formatPercent(event.cycleReturnPct)}
                        </td>
                        <td className="p-3 text-right font-mono text-sm">
                          {event.daysToVixRecovery === null ? '—' : formatNumber(event.daysToVixRecovery, 0)}
                        </td>
                        <td className="p-3 text-right font-mono text-sm">
                          {event.daysToBaselineRecovery !== null
                            ? formatNumber(event.daysToBaselineRecovery, 0)
                            : event.recoveryDate && (event.stressChangePct ?? 0) < 0
                              ? 'Not regained'
                              : '—'}
                        </td>
                        <td className="p-3 text-right font-mono text-sm">
                          {formatMovingAverage(
                            event.peakMovingAverages.fourWeek,
                            event.peakMovingAverages.priceVsFourWeekPct,
                            currency,
                          )}
                        </td>
                        <td className="p-3 text-right font-mono text-sm">
                          {formatMovingAverage(
                            event.peakMovingAverages.thirteenWeek,
                            event.peakMovingAverages.priceVsThirteenWeekPct,
                            currency,
                          )}
                        </td>
                        <td className="p-3 text-right font-mono text-sm">
                          {formatMovingAverage(
                            event.recoveryMovingAverages.fourWeek,
                            event.recoveryMovingAverages.priceVsFourWeekPct,
                            currency,
                          )}
                        </td>
                        <td className="p-3 text-right font-mono text-sm">
                          {formatMovingAverage(
                            event.recoveryMovingAverages.thirteenWeek,
                            event.recoveryMovingAverages.priceVsThirteenWeekPct,
                            currency,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Moving averages are calculated from weekly closes. A missing value means the complete 4-week or
              13-week window was not available at that date. “Days to baseline” is measured at the first
              weekly close at or above the pre-peak baseline, within the VIX recovery window.
            </p>
          </div>
        </>
      )}
    </section>
  )
}
