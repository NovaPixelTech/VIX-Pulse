import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Search, TrendingDown, TrendingUp } from 'lucide-react'
import { useData } from '@/hooks/useData'
import { usePageTitle } from '@/hooks/usePageTitle'
import { CardSkeleton, TableSkeleton } from '@/components/Skeleton'
import { formatDate, formatNumber, formatPercent } from '@/lib/utils'
import {
  rankVixResponses,
  VIX_RESPONSE_PEAK_THRESHOLD,
  VIX_RESPONSE_RECOVERY_THRESHOLD,
  type RankedVixResponse,
} from '@/lib/vixResponse'

type SortKey =
  | 'magnitudeScore'
  | 'absoluteMove'
  | 'vixCorrelation'
  | 'vixSlope'
  | 'drawdown'
  | 'rebound'
  | 'recoveryRate'
  | 'cycleReturn'
  | 'baselineRecoveryDays'
  | 'cycleCount'

function SortHeader({
  label,
  column,
  sortKey,
  sortAsc,
  onSort,
  className,
}: {
  label: string
  column: SortKey
  sortKey: SortKey
  sortAsc: boolean
  onSort: (key: SortKey) => void
  className?: string
}) {
  const active = sortKey === column
  return (
    <th
      className={`p-3 text-right ${className ?? ''}`}
      aria-sort={active ? (sortAsc ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {label}
        <span aria-hidden="true">{active ? (sortAsc ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  )
}

function metricValue(item: RankedVixResponse, key: SortKey): number | null {
  switch (key) {
    case 'magnitudeScore':
      return item.magnitudeScore
    case 'absoluteMove':
      return item.stats.absoluteReboundPct.average
    case 'vixCorrelation':
      return item.vixCoMovement.correlation === null ? null : Math.abs(item.vixCoMovement.correlation)
    case 'vixSlope':
      return item.vixCoMovement.returnPctPerVixPoint
    case 'drawdown':
      return item.stats.drawdownPct.average
    case 'rebound':
      return item.stats.reboundPct.average
    case 'recoveryRate':
      return item.positiveRecoveryRatePct
    case 'cycleReturn':
      return item.stats.cycleReturnPct.average
    case 'baselineRecoveryDays':
      return item.stats.daysToBaselineRecovery.average
    case 'cycleCount':
      return item.cycleCount
  }
}

function compareResponses(a: RankedVixResponse, b: RankedVixResponse, key: SortKey, ascending: boolean) {
  const aValue = metricValue(a, key)
  const bValue = metricValue(b, key)
  if (aValue === null) return bValue === null ? a.asset.ticker.localeCompare(b.asset.ticker) : 1
  if (bValue === null) return -1
  const result = aValue - bValue
  return (ascending ? result : -result) || a.asset.ticker.localeCompare(b.asset.ticker)
}

function returnClass(value: number | null): string {
  if (value === null) return 'text-muted-foreground'
  return value >= 0 ? 'text-success' : 'text-destructive'
}

function formatRate(value: number | null, decimals = 2): string {
  return value === null ? '—' : `${formatNumber(value, decimals)}%`
}

function formatMagnitudePercent(value: number | null): string {
  return value === null ? '—' : `${formatNumber(value)}%`
}

function formatCorrelation(value: number | null): string {
  return value === null ? '—' : `${value >= 0 ? '+' : ''}${formatNumber(value, 3)}`
}

function formatVixSlope(value: number | null): string {
  return value === null ? '—' : `${value >= 0 ? '+' : ''}${formatNumber(value, 3)}%/pt`
}

export default function VixResponse() {
  const { data, loading, error } = useData()
  usePageTitle('VIX Response Ranking')
  const [search, setSearch] = useState('')
  const [analysisFrom, setAnalysisFrom] = useState('2025-09-01')
  const [analysisTo, setAnalysisTo] = useState('2026-09-14')
  const [sortKey, setSortKey] = useState<SortKey>('rebound')
  const [sortAsc, setSortAsc] = useState(false)

  const ranked = useMemo(
    () =>
      rankVixResponses(
        data?.assets ?? [],
        VIX_RESPONSE_PEAK_THRESHOLD,
        VIX_RESPONSE_RECOVERY_THRESHOLD,
        data?.dailyVix,
        { from: analysisFrom || undefined, to: analysisTo || undefined },
      ),
    [data, analysisFrom, analysisTo],
  )
  const query = search.trim().toLowerCase()
  const searched = query
    ? ranked.filter(({ asset }) =>
        [asset.ticker, asset.name, asset.isin].some((value) => value.toLowerCase().includes(query)),
      )
    : ranked
  const sorted = [...searched].sort((a, b) => compareResponses(a, b, sortKey, sortAsc))
  const navigationOrder = [...ranked]
    .sort((a, b) => compareResponses(a, b, sortKey, sortAsc))
    .map((item) => item.asset.isin)

  const totalCycleObservations = ranked.flatMap((item) =>
    item.events.filter((event) => event.cycleReturnPct !== null),
  )
  const totalPositiveRecoveries = ranked.reduce((sum, item) => sum + item.positiveRecoveryCount, 0)
  const totalRecoveredEvents = ranked.reduce((sum, item) => sum + item.recoveredEventCount, 0)
  const dailyAssetPriceCount = ranked.filter(
    ({ asset }) => asset.dailyPriceSeries?.length === data?.dailyVix?.dates.length,
  ).length
  const dailyCoMovementCount = ranked.filter((item) => item.vixCoMovement.correlation !== null).length
  const averageCycleReturn =
    totalCycleObservations.length > 0
      ? totalCycleObservations.reduce((sum, event) => sum + event.cycleReturnPct!, 0) /
        totalCycleObservations.length
      : null
  const positiveRecoveryRate =
    totalRecoveredEvents > 0 ? (totalPositiveRecoveries / totalRecoveredEvents) * 100 : null
  const distinctCycles = new Set(
    ranked.flatMap((item) => item.cycles.map((cycle) => cycle.recoveryDate ?? cycle.representative.peakDate)),
  ).size
  const mostMoved = [...ranked]
    .filter((item) => item.stats.absoluteReboundPct.average !== null)
    .sort(
      (left, right) => right.stats.absoluteReboundPct.average! - left.stats.absoluteReboundPct.average!,
    )[0]
  const leastMoved = [...ranked]
    .filter((item) => item.stats.absoluteReboundPct.average !== null)
    .sort(
      (left, right) => left.stats.absoluteReboundPct.average! - right.stats.absoluteReboundPct.average!,
    )[0]
  const leastCorrelated = [...ranked]
    .filter((item) => item.vixCoMovement.correlation !== null)
    .sort(
      (left, right) => Math.abs(left.vixCoMovement.correlation!) - Math.abs(right.vixCoMovement.correlation!),
    )[0]

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((current) => !current)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading VIX response ranking">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
        <TableSkeleton />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-destructive">Error loading data: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Activity className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary">VIX response</p>
            <h1 className="text-3xl font-bold sm:text-4xl">VIX peak-to-recovery response</h1>
          </div>
        </div>
        <p className="max-w-4xl text-muted-foreground">
          Compare asset price changes after every daily VIX local high strictly above{' '}
          {VIX_RESPONSE_PEAK_THRESHOLD}, through the first daily VIX close below{' '}
          {VIX_RESPONSE_RECOVERY_THRESHOLD}. The default table order is descending signed average
          peak-to-recovery return, matching the supplied comparison. Average absolute price movement is shown
          separately and is not a performance ranking.
        </p>
        <p className="text-sm text-muted-foreground">
          Report window {formatDate(analysisFrom)} – {formatDate(analysisTo)} · {distinctCycles} recovery
          windows ·{' '}
          {data.dailyVix
            ? `daily VIX highs; ${dailyAssetPriceCount}/${ranked.length} daily closes; ${dailyCoMovementCount}/${ranked.length} correlation samples`
            : 'weekly fallback data'}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Analysis start date</span>
          <input
            type="date"
            value={analysisFrom}
            onChange={(event) => setAnalysisFrom(event.target.value)}
            className="block w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Analysis end date</span>
          <input
            type="date"
            value={analysisTo}
            onChange={(event) => setAnalysisTo(event.target.value)}
            className="block w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
      </section>

      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
        aria-label="VIX response overview"
      >
        <div className="rounded-xl border border-border bg-card p-5 card-glow">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />
            <span className="text-sm">Highest average absolute move</span>
          </div>
          {mostMoved ? (
            <Link
              to={`/asset/${mostMoved.asset.isin}`}
              state={{ assetOrder: navigationOrder }}
              className="block w-fit rounded font-bold hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {mostMoved.asset.ticker}
            </Link>
          ) : (
            <p className="truncate text-xl font-bold">—</p>
          )}
          <p className="font-mono text-2xl font-bold text-success">
            {formatPercent(mostMoved?.stats.absoluteReboundPct.average)}
          </p>
          <p className={`mt-1 text-xs ${returnClass(mostMoved?.stats.reboundPct.average ?? null)}`}>
            Signed mean return {formatPercent(mostMoved?.stats.reboundPct.average)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 card-glow">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <TrendingDown className="h-4 w-4 text-destructive" aria-hidden="true" />
            <span className="text-sm">Lowest average absolute move</span>
          </div>
          {leastMoved ? (
            <Link
              to={`/asset/${leastMoved.asset.isin}`}
              state={{ assetOrder: navigationOrder }}
              className="block w-fit rounded font-bold hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {leastMoved.asset.ticker}
            </Link>
          ) : (
            <p className="truncate text-xl font-bold">—</p>
          )}
          <p className="font-mono text-2xl font-bold text-destructive">
            {formatPercent(leastMoved?.stats.absoluteReboundPct.average)}
          </p>
          <p className={`mt-1 text-xs ${returnClass(leastMoved?.stats.reboundPct.average ?? null)}`}>
            Signed mean return {formatPercent(leastMoved?.stats.reboundPct.average)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 card-glow">
          <p className="mb-2 text-sm text-muted-foreground">Positive peak-to-recovery returns</p>
          <p className={`font-mono text-2xl font-bold ${returnClass(positiveRecoveryRate)}`}>
            {formatRate(positiveRecoveryRate, 1)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalPositiveRecoveries} of {totalRecoveredEvents} recovered asset-peak observations
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 card-glow">
          <p className="mb-2 text-sm text-muted-foreground">Average baseline-to-recovery P/L</p>
          <p className={`font-mono text-2xl font-bold ${returnClass(averageCycleReturn)}`}>
            {formatPercent(averageCycleReturn, 1)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Equal-weight average across individual recovered peaks
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 card-glow">
          <p className="mb-2 text-sm text-muted-foreground">Lowest |daily correlation with VIX|</p>
          {leastCorrelated ? (
            <Link
              to={`/asset/${leastCorrelated.asset.isin}`}
              state={{ assetOrder: navigationOrder }}
              className="block w-fit rounded font-bold hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {leastCorrelated.asset.ticker}
            </Link>
          ) : (
            <p className="truncate text-xl font-bold">—</p>
          )}
          <p className="font-mono text-2xl font-bold text-primary">
            {formatCorrelation(leastCorrelated?.vixCoMovement.correlation ?? null)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pearson r · {leastCorrelated?.vixCoMovement.observations ?? 0} sessions · slope{' '}
            {formatVixSlope(leastCorrelated?.vixCoMovement.returnPctPerVixPoint ?? null)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">How to read the return ranking and movement score</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The table defaults to descending signed average peak-to-recovery return, as in the supplied
          comparison. The separate 0–100 absolute-move percentile ranks each asset's average absolute move; it
          measures movement size, not whether the return was positive and is not a VIX sensitivity score.
          Daily co-movement is measured separately as Pearson correlation between asset close-to-close
          percentage returns and daily VIX close point changes on common adjacent observed sessions; the
          regression slope is asset-return percent per VIX point, and small absolute correlation means weaker
          linear co-movement in this window. Every qualifying local peak in the selected dates contributes
          once; shared recovery dates are grouped only for cycle visualization, not for event averages. When
          daily data is unavailable, the fallback is clearly marked and is less precise.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Asset response ranking</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {sorted.length} of {ranked.length} assets · sort by any metric · open an asset for every peak
              and min/average/max values
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search VIX response ranking"
              placeholder="Search by ticker, name, or ISIN"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">No assets match “{search}”.</p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
            >
              Clear search
            </button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-border bg-card card-glow sm:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1340px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Rank</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Asset</th>
                      <SortHeader
                        label="Abs-move percentile"
                        column="magnitudeScore"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="Avg absolute move"
                        column="absoluteMove"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="|Daily VIX corr. r|"
                        column="vixCorrelation"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="Return slope (%/pt)"
                        column="vixSlope"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="Avg drawdown"
                        column="drawdown"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="Avg rebound"
                        column="rebound"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="Positive rebounds"
                        column="recoveryRate"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="Avg cycle P/L"
                        column="cycleReturn"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="Days to regain baseline"
                        column="baselineRecoveryDays"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="Cycles"
                        column="cycleCount"
                        sortKey={sortKey}
                        sortAsc={sortAsc}
                        onSort={toggleSort}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((item, index) => (
                      <tr key={item.asset.isin} className="border-t border-border hover:bg-muted/30">
                        <td className="p-3 font-mono text-sm text-muted-foreground">#{index + 1}</td>
                        <td className="p-3">
                          <Link
                            to={`/asset/${item.asset.isin}`}
                            state={{ assetOrder: navigationOrder }}
                            className="group block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <span className="font-semibold group-hover:text-primary">
                              {item.asset.ticker}
                            </span>
                            {item.asset.customDataSource && (
                              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                                {item.asset.customDataSource}
                              </span>
                            )}
                            <span className="block max-w-56 truncate text-xs text-muted-foreground">
                              {item.asset.name}
                            </span>
                          </Link>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-primary">
                          {formatNumber(item.magnitudeScore, 1)}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold">
                          {formatMagnitudePercent(item.stats.absoluteReboundPct.average)}
                        </td>
                        <td
                          className="p-3 text-right font-mono"
                          title={`Signed Pearson correlation: ${formatCorrelation(item.vixCoMovement.correlation)}; ${item.vixCoMovement.observations} observations`}
                        >
                          {item.vixCoMovement.correlation === null
                            ? '—'
                            : formatNumber(Math.abs(item.vixCoMovement.correlation), 3)}
                        </td>
                        <td
                          className="p-3 text-right font-mono"
                          title="Regression slope: asset return percent per one VIX point change"
                        >
                          {formatVixSlope(item.vixCoMovement.returnPctPerVixPoint)}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {formatMagnitudePercent(item.stats.drawdownPct.average)}
                        </td>
                        <td
                          className={`p-3 text-right font-mono ${returnClass(item.stats.reboundPct.average)}`}
                        >
                          {formatPercent(item.stats.reboundPct.average)}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {formatRate(item.positiveRecoveryRatePct, 1)}
                        </td>
                        <td
                          className={`p-3 text-right font-mono font-semibold ${returnClass(item.stats.cycleReturnPct.average)}`}
                        >
                          {formatPercent(item.stats.cycleReturnPct.average)}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          {formatNumber(item.stats.daysToBaselineRecovery.average, 0)}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">{item.cycleCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3 sm:hidden">
              {sorted.map((item, index) => (
                <Link
                  key={item.asset.isin}
                  to={`/asset/${item.asset.isin}`}
                  state={{ assetOrder: navigationOrder }}
                  className="block rounded-xl border border-border bg-card p-4 text-left card-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
                        <span className="font-semibold">{item.asset.ticker}</span>
                        {item.asset.customDataSource && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {item.asset.customDataSource}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{item.asset.name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xl font-bold text-primary">
                        {formatMagnitudePercent(item.stats.absoluteReboundPct.average)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">average absolute move</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/70 pt-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Abs-move percentile</p>
                      <p className="font-mono">{formatNumber(item.magnitudeScore, 1)} / 100</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg drawdown</p>
                      <p className="font-mono">{formatMagnitudePercent(item.stats.drawdownPct.average)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Daily VIX correlation (r)</p>
                      <p className="font-mono">{formatCorrelation(item.vixCoMovement.correlation)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Common sessions</p>
                      <p className="font-mono">{item.vixCoMovement.observations}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Return slope (%/VIX point)</p>
                      <p className="font-mono">{formatVixSlope(item.vixCoMovement.returnPctPerVixPoint)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg rebound</p>
                      <p className={`font-mono ${returnClass(item.stats.reboundPct.average)}`}>
                        {formatPercent(item.stats.reboundPct.average)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Positive rebounds</p>
                      <p className="font-mono">{formatRate(item.positiveRecoveryRatePct, 1)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg cycle P/L</p>
                      <p className={`font-mono ${returnClass(item.stats.cycleReturnPct.average)}`}>
                        {formatPercent(item.stats.cycleReturnPct.average)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {item.cycleCount} cycles · {formatNumber(item.stats.daysToBaselineRecovery.average, 0)}{' '}
                    days average to regain baseline
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        VIX peaks use daily highs and are strict local maxima above {VIX_RESPONSE_PEAK_THRESHOLD}; recovery is
        the first daily VIX close below {VIX_RESPONSE_RECOVERY_THRESHOLD}. Asset peak/recovery prices use the
        latest available asset close on or before the respective VIX date. Baselines, moving averages, and
        time-to-baseline recovery remain weekly estimates. This is historical analysis, not investment advice.
      </p>
    </div>
  )
}
