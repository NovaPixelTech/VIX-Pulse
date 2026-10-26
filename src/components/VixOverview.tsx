import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarDays, Clock3, Minus } from 'lucide-react'
import type { Dataset, VixMetrics } from '@/types'
import { deriveVixMetrics, getVixRegime } from '@/lib/vix'
import { cn, formatDate, formatNumber, formatPercent } from '@/lib/utils'

function ChangeLine({
  absolute,
  percent,
  comparison,
  comparisonDate,
}: {
  absolute: number
  percent: number
  comparison: string
  comparisonDate: string
}) {
  const flat = Math.abs(absolute) < 0.005
  const rising = absolute > 0
  const Icon = flat ? Minus : rising ? ArrowUpRight : ArrowDownRight
  const color = flat
    ? 'text-muted-foreground'
    : rising
      ? 'text-red-600 dark:text-red-400'
      : 'text-emerald-700 dark:text-emerald-400'

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className={cn('inline-flex items-center gap-0.5 font-mono font-semibold', color)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {absolute > 0 ? '+' : ''}
        {formatNumber(absolute, 2)}
        <span className="text-xs">({formatPercent(percent)})</span>
      </span>
      <span className="text-muted-foreground">
        vs {comparison} <span className="font-mono">{comparisonDate}</span>
      </span>
    </div>
  )
}

function RegimeBadge({ value }: { value: number }) {
  const regime = getVixRegime(value)
  return (
    <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs">
      <span className={cn('h-2 w-2 rounded-full', regime.dotClass)} />
      <span className={cn('font-semibold', regime.textClass)}>{regime.label} volatility</span>
      <span className="text-muted-foreground">· {regime.range}</span>
    </span>
  )
}

function VixCard({
  label,
  value,
  date,
  previous,
  previousDate,
  absolute,
  percent,
  comparison,
  dateLabel,
  icon,
}: {
  label: string
  value: number
  date: string
  previous: number
  previousDate: string
  absolute: number
  percent: number
  comparison: string
  dateLabel: string
  icon: ReactNode
}) {
  const regime = getVixRegime(value)

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-6 card-glow',
        regime.borderClass,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full blur-3xl opacity-40',
          regime.bgClass,
        )}
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <RegimeBadge value={value} />
      </div>

      <div className="relative mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
        <p
          className={cn(
            'font-mono text-5xl font-bold leading-none tracking-tight sm:text-6xl',
            regime.textClass,
          )}
        >
          {formatNumber(value, 2)}
        </p>
        <div className="pb-1">
          <p className="text-sm text-muted-foreground">{formatDate(date)}</p>
          <p className="text-xs text-muted-foreground/80">{dateLabel}</p>
        </div>
      </div>

      <div className="relative mt-5 border-t border-border/70 pt-4">
        <ChangeLine
          absolute={absolute}
          percent={percent}
          comparison={`${comparison} close ${formatNumber(previous, 2)} ·`}
          comparisonDate={formatDate(previousDate)}
        />
        <p className="mt-2 text-xs text-muted-foreground">{regime.description}</p>
      </div>
    </article>
  )
}

function Scale() {
  const zones = [
    { label: 'Low', range: '< 15', className: 'bg-sky-400', text: 'text-sky-700 dark:text-sky-400' },
    {
      label: 'Normal',
      range: '15 – < 20',
      className: 'bg-emerald-400',
      text: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: 'Elevated',
      range: '20 – < 30',
      className: 'bg-amber-400',
      text: 'text-amber-700 dark:text-amber-400',
    },
    { label: 'High', range: '≥ 30', className: 'bg-red-400', text: 'text-red-600 dark:text-red-400' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs">
      <span className="font-medium text-muted-foreground">VIX regime guide</span>
      {zones.map((zone) => (
        <span key={zone.label} className="inline-flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', zone.className)} />
          <span className={zone.text}>{zone.label}</span>
          <span className="font-mono text-muted-foreground">{zone.range}</span>
        </span>
      ))}
    </div>
  )
}

export default function VixOverview({ data }: { data: Dataset }) {
  const metrics: VixMetrics | null = deriveVixMetrics(data)
  if (!metrics) return null

  return (
    <section aria-labelledby="vix-now-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="vix-now-heading" className="text-lg font-semibold">
            Volatility now
          </h2>
          <p className="text-sm text-muted-foreground">
            Current VIX plus the weekly series through {formatDate(data.dateRange.to)}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VixCard
          label="VIX today"
          value={metrics.currentVix}
          date={metrics.currentDate}
          previous={metrics.previousDayVix}
          previousDate={metrics.previousDayDate}
          absolute={metrics.changeDayAbs}
          percent={metrics.changeDayPct}
          comparison="previous day"
          dateLabel="Latest available quote"
          icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
        />
        <VixCard
          label="VIX · latest closed week"
          value={metrics.latestWeekVix}
          date={metrics.latestWeekDate}
          previous={metrics.previousWeekVix}
          previousDate={metrics.previousWeekDate}
          absolute={metrics.changeWeekAbs}
          percent={metrics.changeWeekPct}
          comparison="previous week"
          dateLabel="Week-ended close"
          icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <Scale />
    </section>
  )
}
