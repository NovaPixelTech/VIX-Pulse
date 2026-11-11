import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from 'lucide-react'
import type { Dataset } from '@/types'
import { useRealtimeVix } from '@/hooks/useRealtimeVix'
import { deriveVixMetrics, getVixRegime } from '@/lib/vix'
import type { RealtimeVixPoint, VixMarketState } from '@/lib/realtimeVix'
import { cn, formatDate, formatNumber, formatPercent } from '@/lib/utils'

const GAUGE_MIN = 10
const GAUGE_MAX = 40

const GAUGE_SEGMENTS = [
  { label: 'Low', from: GAUGE_MIN, to: 15, className: 'bg-sky-500' },
  { label: 'Normal', from: 15, to: 20, className: 'bg-emerald-500' },
  { label: 'Elevated', from: 20, to: 30, className: 'bg-amber-500' },
  { label: 'High', from: 30, to: GAUGE_MAX, className: 'bg-red-500' },
]

const MARKET_STATE: Record<VixMarketState, { label: string; dotClass: string }> = {
  regular: { label: 'Market open', dotClass: 'bg-emerald-500' },
  pre: { label: 'Pre-market', dotClass: 'bg-amber-500' },
  post: { label: 'After hours', dotClass: 'bg-amber-500' },
  closed: { label: 'Market closed', dotClass: 'bg-muted-foreground/50' },
}

function LiveDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
        style={{ backgroundColor: color }}
      />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  )
}

function formatQuoteTime(timeMs: number | null, timeZone: string | null): string {
  if (timeMs === null) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone ?? 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(timeMs))
  } catch {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(timeMs))
  }
}

function UpdatedAgo({ atMs }: { atMs: number }) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const seconds = Math.max(0, Math.round((nowMs - atMs) / 1000))
  return (
    <span className="tabular-nums">
      Updated {seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`} ago
    </span>
  )
}

function IntradaySparkline({
  points,
  previousClose,
  color,
}: {
  points: RealtimeVixPoint[]
  previousClose: number | null
  color: string
}) {
  if (points.length < 2) return null
  const width = 100
  const height = 36
  const values = [...points.map((point) => point.close), ...(previousClose !== null ? [previousClose] : [])]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const x = (index: number) => (index / (points.length - 1)) * width
  const y = (value: number) => 3 + (1 - (value - min) / range) * (height - 6)
  const linePoints = points.map((point, index) => `${x(index).toFixed(2)},${y(point.close).toFixed(2)}`)
  const areaPath = `M0,${height} L${linePoints.join(' L ')} L${width},${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-12 w-full sm:h-14"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="live-vix-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {previousClose !== null && previousClose >= min && previousClose <= max && (
        <line
          x1="0"
          x2={width}
          y1={y(previousClose)}
          y2={y(previousClose)}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
          className="text-muted-foreground/60"
        />
      )}
      <path d={areaPath} fill="url(#live-vix-spark)" />
      <polyline
        points={linePoints.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function LevelGauge({ value, color }: { value: number; color: string }) {
  const position = Math.min(1, Math.max(0, (value - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)))
  const ticks = [
    { value: GAUGE_MIN, transform: 'none' },
    { value: 15, transform: 'translateX(-50%)' },
    { value: 20, transform: 'translateX(-50%)' },
    { value: 30, transform: 'translateX(-50%)' },
    { value: GAUGE_MAX, transform: 'translateX(-100%)' },
  ]
  return (
    <div className="mx-auto w-full max-w-xl">
      <div
        className="relative"
        role="img"
        aria-label={`VIX ${formatNumber(value, 2)} positioned on a scale from ${GAUGE_MIN} to ${GAUGE_MAX}`}
      >
        <div className="flex h-2 overflow-hidden rounded-full" aria-hidden="true">
          {GAUGE_SEGMENTS.map((segment) => (
            <div
              key={segment.label}
              className={segment.className}
              style={{ width: `${((segment.to - segment.from) / (GAUGE_MAX - GAUGE_MIN)) * 100}%` }}
            />
          ))}
        </div>
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-md"
          style={{ left: `${position * 100}%`, backgroundColor: color }}
          aria-hidden="true"
        />
      </div>
      <div className="relative mt-1.5 h-4" aria-hidden="true">
        {ticks.map((tick) => (
          <span
            key={tick.value}
            className="absolute font-mono text-[10px] text-muted-foreground"
            style={{
              left: `${((tick.value - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)) * 100}%`,
              transform: tick.transform,
            }}
          >
            {tick.value}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function RealtimeVixBanner({ data }: { data: Dataset }) {
  const { quote: liveQuote, loading, refreshing, error, refresh } = useRealtimeVix()
  const snapshot = deriveVixMetrics(data)

  const isLive = liveQuote !== null
  const value = isLive ? liveQuote.price : (snapshot?.currentVix ?? null)
  if (value === null || Number.isNaN(value)) return null

  const regime = getVixRegime(value)
  const changeAbs = isLive ? liveQuote.changeAbs : (snapshot?.changeDayAbs ?? 0)
  const changePct = isLive ? liveQuote.changePct : (snapshot?.changeDayPct ?? 0)
  const previous = isLive ? liveQuote.previousClose : (snapshot?.previousDayVix ?? null)
  const previousDate = isLive ? null : (snapshot?.previousDayDate ?? null)

  const flat = Math.abs(changeAbs) < 0.005
  const ChangeIcon = flat ? Minus : changeAbs > 0 ? ArrowUpRight : ArrowDownRight
  const changeColor = flat
    ? 'text-muted-foreground'
    : changeAbs > 0
      ? 'text-red-600 dark:text-red-400'
      : 'text-emerald-700 dark:text-emerald-400'

  const marketState = MARKET_STATE[isLive ? liveQuote.marketState : 'closed']

  return (
    <section
      aria-label="Live VIX index level"
      className={cn('relative overflow-hidden rounded-3xl border bg-card card-glow', regime.borderClass)}
    >
      <div
        className="pointer-events-none absolute inset-x-0 -top-40 h-96 opacity-[0.16]"
        style={{ background: `radial-gradient(closest-side, ${regime.hex}, transparent)` }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 -bottom-24 h-64 opacity-[0.08]"
        style={{ background: `radial-gradient(closest-side, ${regime.hex}, transparent)` }}
        aria-hidden="true"
      />

      <p className="sr-only" aria-live="polite">
        {isLive
          ? `Live VIX ${formatNumber(value, 2)}, ${regime.label.toLowerCase()} volatility, ${flat ? 'unchanged' : changeAbs > 0 ? 'up' : 'down'} ${formatNumber(Math.abs(changeAbs), 2)} points from the previous close.`
          : `Published VIX snapshot ${formatNumber(value, 2)}, ${regime.label.toLowerCase()} volatility.`}
      </p>

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-8 text-center sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
            <LiveDot color={regime.hex} />
            Live
          </span>
          <span className="text-sm font-medium text-muted-foreground sm:text-base">
            CBOE Volatility Index · ^VIX
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full', marketState.dotClass)} aria-hidden="true" />
            {marketState.label}
          </span>
        </div>

        <p
          key={`${value}`}
          className={cn(
            'animate-vix-pop relative mt-5 font-mono text-7xl font-bold leading-none tracking-tight tabular-nums sm:text-8xl lg:text-9xl',
            regime.textClass,
          )}
          style={{ filter: `drop-shadow(0 0 14px ${regime.hex}66) drop-shadow(0 0 44px ${regime.hex}33)` }}
        >
          {formatNumber(value, 2)}
        </p>

        <span
          className={cn(
            'mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold',
            regime.borderClass,
            regime.bgClass,
            regime.textClass,
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', regime.dotClass)} aria-hidden="true" />
          {regime.label} volatility
          <span className="font-mono text-xs font-normal text-muted-foreground">{regime.range}</span>
        </span>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm sm:text-base">
          <span className={cn('inline-flex items-center gap-1 font-mono font-semibold', changeColor)}>
            <ChangeIcon className="h-5 w-5" aria-hidden="true" />
            {changeAbs > 0 ? '+' : ''}
            {formatNumber(changeAbs, 2)}
            <span className="text-xs sm:text-sm">({formatPercent(changePct)})</span>
          </span>
          <span className="text-muted-foreground">
            vs previous close {formatNumber(previous, 2)}
            {previousDate && <span> · {formatDate(previousDate)}</span>}
          </span>
        </div>

        {isLive && (
          <div className="mt-6 w-full max-w-xl">
            <IntradaySparkline
              points={liveQuote.intraday}
              previousClose={liveQuote.previousClose}
              color={regime.hex}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Intraday 5-minute closes · dashed line marks the previous close
            </p>
          </div>
        )}

        <div className="mt-6 w-full">
          <LevelGauge value={value} color={regime.hex} />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          {isLive ? (
            <>
              <span>Quote {formatQuoteTime(liveQuote.quoteTimeMs, liveQuote.exchangeTimeZone)}</span>
              {(liveQuote.dayHigh !== null || liveQuote.dayLow !== null) && (
                <span className="font-mono">
                  Day range {formatNumber(liveQuote.dayLow ?? liveQuote.dayHigh, 2)}–
                  {formatNumber(liveQuote.dayHigh ?? liveQuote.dayLow, 2)}
                </span>
              )}
              {refreshing ? (
                <span className="animate-pulse">Updating…</span>
              ) : (
                <UpdatedAgo key={liveQuote.fetchedAtMs} atMs={liveQuote.fetchedAtMs} />
              )}
            </>
          ) : (
            <span>
              Published snapshot close · {formatDate(snapshot?.currentDate)}
              {loading && <span className="animate-pulse"> · connecting live…</span>}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60"
            aria-label={refreshing ? 'Refreshing the live VIX quote' : 'Refresh the live VIX quote now'}
            title="Refresh the live quote now"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-muted-foreground/80">
          {isLive
            ? error
              ? 'Live update failed · showing the last live quote. Retries continue automatically.'
              : 'Live quote from Yahoo Finance, refreshed about once a minute; it can run slightly behind the exchange.'
            : error
              ? 'Live quote unavailable right now · showing the published snapshot. Retries continue automatically.'
              : 'Falls back to the published snapshot whenever the live relay cannot be reached.'}
        </p>
      </div>
    </section>
  )
}
