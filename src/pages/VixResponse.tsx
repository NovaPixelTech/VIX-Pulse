import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Search, TrendingDown, TrendingUp } from 'lucide-react'
import { useData } from '@/hooks/useData'
import { usePageTitle } from '@/hooks/usePageTitle'
import { CardSkeleton, TableSkeleton } from '@/components/Skeleton'
import { formatDate, formatNumber, formatPercent } from '@/lib/utils'
import { rankVixResponses, type RankedVixResponse } from '@/lib/vixResponse'

type SortKey =
  | 'sensitivityScore'
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
    case 'sensitivityScore':
      return item.sensitivityScore
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

export default function VixResponse() {
  const { data, loading, error } = useData()
  usePageTitle('VIX Response Ranking')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('sensitivityScore')
  const [sortAsc, setSortAsc] = useState(false)

  const ranked = useMemo(() => rankVixResponses(data?.assets ?? []), [data])
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
    item.cycles.filter((cycle) => cycle.representative.cycleReturnPct !== null),
  )
  const totalPositiveRecoveries = ranked.reduce((sum, item) => sum + item.positiveRecoveryCount, 0)
  const totalRecoveredCycles = ranked.reduce((sum, item) => sum + item.recoveredCycleCount, 0)
  const averageCycleReturn =
    totalCycleObservations.length > 0
      ? totalCycleObservations.reduce((sum, cycle) => sum + cycle.representative.cycleReturnPct!, 0) /
        totalCycleObservations.length
      : null
  const positiveRecoveryRate =
    totalRecoveredCycles > 0 ? (totalPositiveRecoveries / totalRecoveredCycles) * 100 : null
  const distinctCycles = new Set(
    ranked.flatMap((item) => item.cycles.map((cycle) => cycle.recoveryDate ?? cycle.representative.peakDate)),
  ).size
  const best = ranked[0]
  const worst = ranked[ranked.length - 1]

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
            <h1 className="text-3xl font-bold sm:text-4xl">Sensitivity ranking</h1>
          </div>
        </div>
        <p className="max-w-4xl text-muted-foreground">
          Compare how assets move during VIX spikes above 25 and recoveries back below 20. The default order
          rewards a larger pre-peak drawdown followed by a stronger, more consistent rebound; average
          baseline-to-recovery return is shown separately as profit/loss.
        </p>
        <p className="text-sm text-muted-foreground">
          Weekly prices through{' '}
          <span className="font-medium text-foreground">{formatDate(data.dateRange.to)}</span>
          {' · '}
          {distinctCycles} grouped VIX recovery windows · 4-week and 13-week moving averages
        </p>
      </header>

      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="VIX response overview"
      >
        <div className="rounded-xl border border-border bg-card p-5 card-glow">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />
            <span className="text-sm">Highest sensitivity score</span>
          </div>
          {best ? (
            <Link
              to={`/asset/${best.asset.isin}`}
              state={{ assetOrder: navigationOrder }}
              className="block w-fit rounded font-bold hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {best.asset.ticker}
            </Link>
          ) : (
            <p className="truncate text-xl font-bold">—</p>
          )}
          <p className="font-mono text-2xl font-bold text-success">
            {best ? formatNumber(best.sensitivityScore, 1) : '—'}
            <span className="ml-1 text-sm font-medium text-muted-foreground">/ 100</span>
          </p>
          <p className={`mt-1 text-xs ${returnClass(best?.stats.cycleReturnPct.average ?? null)}`}>
            Average cycle P/L {formatPercent(best?.stats.cycleReturnPct.average)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 card-glow">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <TrendingDown className="h-4 w-4 text-destructive" aria-hidden="true" />
            <span className="text-sm">Lowest sensitivity score</span>
          </div>
          {worst ? (
            <Link
              to={`/asset/${worst.asset.isin}`}
              state={{ assetOrder: navigationOrder }}
              className="block w-fit rounded font-bold hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {worst.asset.ticker}
            </Link>
          ) : (
            <p className="truncate text-xl font-bold">—</p>
          )}
          <p className="font-mono text-2xl font-bold text-destructive">
            {worst ? formatNumber(worst.sensitivityScore, 1) : '—'}
            <span className="ml-1 text-sm font-medium text-muted-foreground">/ 100</span>
          </p>
          <p className={`mt-1 text-xs ${returnClass(worst?.stats.cycleReturnPct.average ?? null)}`}>
            Average cycle P/L {formatPercent(worst?.stats.cycleReturnPct.average)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 card-glow">
          <p className="mb-2 text-sm text-muted-foreground">Positive asset rebounds</p>
          <p className={`font-mono text-2xl font-bold ${returnClass(positiveRecoveryRate)}`}>
            {formatRate(positiveRecoveryRate, 1)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalPositiveRecoveries} of {totalRecoveredCycles} asset-cycle observations
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 card-glow">
          <p className="mb-2 text-sm text-muted-foreground">Average cycle profit/loss</p>
          <p className={`font-mono text-2xl font-bold ${returnClass(averageCycleReturn)}`}>
            {formatPercent(averageCycleReturn, 1)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Baseline close to asset price at VIX normalization
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">How the score works</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Each asset is scored from 0–100 using the equal-weight average of its percentile ranks for average
          peak drawdown depth, average rebound, share of positive rebounds, and average time to regain its
          pre-peak baseline. Faster baseline recovery scores higher. The time measure uses weekly closes and
          only cycles that regain their baseline. Missing component data scores zero to avoid rewarding
          incomplete histories. Raw values and P/L remain visible so the score is not a substitute for the
          underlying figures. A cycle is counted once using its highest VIX peak; the asset detail table lists
          every local peak above 25.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Best-to-worst assets</h2>
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
                <table className="w-full min-w-[1120px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Rank</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Asset</th>
                      <SortHeader
                        label="Score"
                        column="sensitivityScore"
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
                            <span className="block max-w-56 truncate text-xs text-muted-foreground">
                              {item.asset.name}
                            </span>
                          </Link>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-primary">
                          {formatNumber(item.sensitivityScore, 1)}
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
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{item.asset.name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xl font-bold text-primary">
                        {formatNumber(item.sensitivityScore, 1)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">score / 100</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/70 pt-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Avg drawdown</p>
                      <p className="font-mono">{formatMagnitudePercent(item.stats.drawdownPct.average)}</p>
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
        Baseline is the last available weekly close before a peak. Peak VIX values use daily intraday highs;
        recovery begins when the daily VIX close is below 20. Week-based moving averages and baseline-return
        timing are estimates from the weekly series. This analysis is for research only, not investment
        advice.
      </p>
    </div>
  )
}
