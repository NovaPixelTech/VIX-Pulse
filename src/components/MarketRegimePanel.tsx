import { useMemo } from 'react'
import { Activity, Gauge, Info, Layers, TrendingDown, TrendingUp } from 'lucide-react'
import type { Dataset } from '@/types'
import {
  getMarketContext,
  termStructureRegimeDescription,
  termStructureRegimeLabel,
  type TermStructureRegime,
} from '@/lib/marketContext'
import { formatDate, formatNumber, formatPercent } from '@/lib/utils'

function changeClass(value: number | null): string {
  if (value === null) return 'text-muted-foreground'
  return value >= 0 ? 'text-destructive' : 'text-success'
}

function regimeClass(regime: TermStructureRegime | null): string {
  switch (regime) {
    case 'backwardation':
      return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400'
    case 'contango':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    case 'flat':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}

function PercentileBar({ percentile }: { percentile: number | null }) {
  if (percentile === null) return <div className="h-2 rounded-full bg-muted" />
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-500 via-amber-500 to-red-500"
        style={{ width: `${Math.max(2, Math.min(100, percentile))}%` }}
      />
    </div>
  )
}

export default function MarketRegimePanel({ data }: { data: Dataset }) {
  const context = useMemo(() => getMarketContext(data), [data])
  const term = context.termStructure
  const percentile = context.percentile.percentile

  return (
    <section className="space-y-3" aria-label="Current VIX market regime">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold">Current volatility regime</h2>
          <p className="text-sm text-muted-foreground">
            VIX level, percentile, term structure, and equity volatility as of {formatDate(context.asOf)}.
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
          Descriptive nowcast · not a forecast
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 card-glow">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm">VIX spot</span>
          </div>
          <div className="flex items-baseline gap-3">
            <p className={`font-mono text-3xl font-bold ${context.vixRegime.textClass}`}>
              {formatNumber(context.vix, 2)}
            </p>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${context.vixRegime.textClass} ${context.vixRegime.borderClass} ${context.vixRegime.bgClass}`}
            >
              {context.vixRegime.label}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">1-day change</p>
              <p className={`font-mono font-semibold ${changeClass(context.change1d.percent)}`}>
                {formatPercent(context.change1d.percent)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">5-day change</p>
              <p className={`font-mono font-semibold ${changeClass(context.change5d.percent)}`}>
                {formatPercent(context.change5d.percent)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {context.vixRegime.description} A high VIX is not automatically a buy signal; the entry study on
            the Edge Lab page tests the executable timing explicitly.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 card-glow">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Gauge className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm">VIX percentile</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="font-mono text-3xl font-bold">{formatNumber(percentile, 0)}</p>
            <span className="text-sm text-muted-foreground">th percentile</span>
          </div>
          <div className="mt-3">
            <PercentileBar percentile={percentile} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {context.percentile.observations} closes from {formatDate(context.percentile.from)} to{' '}
            {formatDate(context.percentile.to)}. Percentile is the share of past closes at or below
            today&apos;s VIX, not a probability of a peak.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Stress thresholds are regime-dependent: VIX 21 is roughly the 70th percentile of the full history,
            so a fixed 21 line fires far more often than a genuine 1-in-10 event.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 card-glow">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Layers className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm">VIX term structure</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${regimeClass(term.regime)}`}
            >
              {termStructureRegimeLabel(term.regime)}
            </span>
            <span className="font-mono text-sm text-muted-foreground">
              VIX/VIX3M {formatNumber(term.frontRatio, 3)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              { label: '9D', value: term.vix9d },
              { label: 'VIX', value: term.vix },
              { label: '3M', value: term.vix3m },
              { label: '6M', value: term.vix6m },
            ].map((point) => (
              <div key={point.label} className="rounded-lg border border-border bg-background/60 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{point.label}</p>
                <p className="font-mono text-sm font-semibold">{formatNumber(point.value, 1)}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {termStructureRegimeDescription(term.regime)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            {context.change1d.percent !== null && context.change1d.percent >= 0 ? (
              <TrendingUp className="h-4 w-4 text-destructive" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-4 w-4 text-success" aria-hidden="true" />
            )}
            <span className="text-sm">Equity benchmark · {context.benchmark?.ticker ?? 'SPY'}</span>
          </div>
          {context.benchmark ? (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="font-mono text-xl font-bold">{formatNumber(context.benchmark.lastClose, 2)}</p>
              <p className="text-sm">
                1D{' '}
                <span className={`font-mono ${changeClass(context.benchmark.change1dPct)}`}>
                  {formatPercent(context.benchmark.change1dPct)}
                </span>
              </p>
              <p className="text-sm">
                5D{' '}
                <span className={`font-mono ${changeClass(context.benchmark.change5dPct)}`}>
                  {formatPercent(context.benchmark.change5dPct)}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Benchmark context is unavailable in this snapshot.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            20-session realised volatility:{' '}
            <span className="font-mono text-foreground">
              {formatPercent(context.benchmark?.realizedVol20dPct ?? null, 1)}
            </span>
            . Compare it with VIX: a wide gap between implied and realised volatility is itself a risk signal.
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="mb-1 flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Info className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-semibold">How to use this panel</span>
          </div>
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
            Treat these as filters, not triggers. A rising VIX percentile with a backwardated curve is a
            stress regime; the Edge Lab then asks whether buying the asset after the VIX crossing actually
            beat SPY after costs. A calm percentile with contango is usually a poor time to expect a large
            rebound.
          </p>
        </div>
      </div>
    </section>
  )
}
