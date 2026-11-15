import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Info,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useData } from '@/hooks/useData'
import { usePageTitle } from '@/hooks/usePageTitle'
import { CardSkeleton, TableSkeleton } from '@/components/Skeleton'
import { formatDate, formatNumber, formatPercent } from '@/lib/utils'
import {
  rankExecutableEdges,
  type EdgeBaseCurrency,
  type ExecutableEdgeResult,
  type ExecutableTrade,
} from '@/lib/executableEdge'

function returnClass(value: number | null): string {
  if (value === null) return 'text-muted-foreground'
  return value >= 0 ? 'text-success' : 'text-destructive'
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  suffix?: string
}) {
  return (
    <label htmlFor={id} className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)))
          }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  )
}

function TradeRow({ trade }: { trade: ExecutableTrade }) {
  return (
    <tr className="border-t border-border align-top">
      <td className="p-3 font-mono text-xs text-muted-foreground">{formatDate(trade.signalDate)}</td>
      <td className="p-3 font-mono text-xs text-muted-foreground">{formatDate(trade.entryDate)}</td>
      <td className="p-3 font-mono text-xs text-muted-foreground">{formatDate(trade.exitDate)}</td>
      <td className="p-3 text-xs capitalize">{trade.exitReason.replace('-', ' ')}</td>
      <td className="p-3 text-right font-mono text-xs">
        {formatNumber(trade.entryPriceLocal, 2)} → {formatNumber(trade.exitPriceLocal, 2)}
      </td>
      <td className={`p-3 text-right font-mono text-sm font-semibold ${returnClass(trade.netReturnPct)}`}>
        {formatPercent(trade.netReturnPct)}
      </td>
      <td className={`p-3 text-right font-mono text-sm ${returnClass(trade.benchmarkNetReturnPct)}`}>
        {formatPercent(trade.benchmarkNetReturnPct)}
      </td>
      <td className={`p-3 text-right font-mono text-sm font-semibold ${returnClass(trade.excessReturnPct)}`}>
        {formatPercent(trade.excessReturnPct)}
      </td>
      <td className="p-3 text-right font-mono text-xs text-muted-foreground">
        {formatNumber(trade.maePct, 1)} / {formatNumber(trade.mfePct, 1)}
      </td>
      <td className="p-3 text-right font-mono text-xs text-muted-foreground">{trade.holdingBars}</td>
    </tr>
  )
}

function StatCard({
  label,
  value,
  sub,
  valueClass = '',
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-glow">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-mono text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function ResultDetail({ result }: { result: ExecutableEdgeResult }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5 card-glow space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">
            {result.ticker} <span className="text-sm font-normal text-muted-foreground">{result.name}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {result.sampleSize} executable trades · {formatDate(result.firstSignalDate)} →{' '}
            {formatDate(result.lastExitDate)} · benchmark {result.benchmarkTicker} · base currency{' '}
            {result.baseCurrency}
          </p>
        </div>
        <Link
          to={`/asset/${result.isin}`}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          Open asset detail
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Mean net return"
          value={formatPercent(result.meanNetReturnPct)}
          valueClass={returnClass(result.meanNetReturnPct)}
          sub="Per trade, after two-way costs"
        />
        <StatCard
          label="Mean excess vs benchmark"
          value={formatPercent(result.meanExcessReturnPct)}
          valueClass={returnClass(result.meanExcessReturnPct)}
          sub="Net asset return minus net benchmark return"
        />
        <StatCard
          label="95% bootstrap interval"
          value={`${formatPercent(result.ci95Low)} to ${formatPercent(result.ci95High)}`}
          sub={`${result.winRatePct === null ? '—' : formatNumber(result.winRatePct, 0) + '%'} of trades beat the benchmark`}
        />
        <StatCard
          label="Profit factor"
          value={formatNumber(result.profitFactor, 2)}
          sub={
            result.profitFactor === null
              ? 'No losing excess trades in this sample'
              : 'Gross positive excess ÷ gross negative excess'
          }
        />
        <StatCard
          label="Average max adverse excursion"
          value={formatPercent(result.meanMaePct)}
          valueClass={returnClass(result.meanMaePct)}
          sub="Worst close-based drawdown while held"
        />
        <StatCard
          label="Average max favourable excursion"
          value={formatPercent(result.meanMfePct)}
          valueClass={returnClass(result.meanMfePct)}
          sub="Best close-based gain while held"
        />
        <StatCard
          label="Compounded result"
          value={formatPercent(result.compoundedNetReturnPct)}
          valueClass={returnClass(result.compoundedNetReturnPct)}
          sub={`Benchmark over same trades: ${formatPercent(result.compoundedBenchmarkReturnPct)}`}
        />
        <StatCard
          label="Time in market"
          value={formatPercent(result.exposurePct, 1)}
          sub={`Mean holding ${formatNumber(result.meanHoldingBars, 1)} sessions`}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[980px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Signal</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Entry</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Exit</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Reason</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">
                Local price (entry → exit)
              </th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">Net</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">Benchmark</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">Excess</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">MAE / MFE</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">Bars</th>
            </tr>
          </thead>
          <tbody>
            {result.trades.map((trade) => (
              <TradeRow key={`${trade.signalDate}-${trade.entryDate}`} trade={trade} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function EdgeLab() {
  const { data, loading, error } = useData()
  usePageTitle('Edge Lab')

  const [peakThreshold, setPeakThreshold] = useState(21)
  const [recoveryThreshold, setRecoveryThreshold] = useState(20)
  const [stopLossPct, setStopLossPct] = useState(10)
  const [maxHoldingDays, setMaxHoldingDays] = useState(60)
  const [costBps, setCostBps] = useState(10)
  const [baseCurrency, setBaseCurrency] = useState<EdgeBaseCurrency>('USD')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [minTrades, setMinTrades] = useState(3)
  const [selectedIsin, setSelectedIsin] = useState<string | null>(null)

  const vixDates = data?.dailyVix?.dates ?? []
  const availableFrom = vixDates[0] ?? data?.dateRange.from ?? ''
  const availableTo = vixDates[vixDates.length - 1] ?? data?.dateRange.to ?? ''

  const ranked = useMemo(() => {
    if (!data) return []
    return rankExecutableEdges(data, {
      peakThreshold,
      recoveryThreshold,
      stopLossPct,
      maxHoldingDays,
      costBps,
      baseCurrency,
      from: fromDate || undefined,
      to: toDate || undefined,
      bootstrapSamples: 1_000,
    })
  }, [
    data,
    peakThreshold,
    recoveryThreshold,
    stopLossPct,
    maxHoldingDays,
    costBps,
    baseCurrency,
    fromDate,
    toDate,
  ])

  const visible = ranked.filter((result) => result.sampleSize >= minTrades)
  const selected = visible.find((result) => result.isin === selectedIsin) ?? visible[0] ?? null
  const totalTrades = ranked.reduce((sum, result) => sum + result.sampleSize, 0)
  const positiveAssets = ranked.filter(
    (result) => result.sampleSize >= minTrades && (result.meanExcessReturnPct ?? 0) > 0,
  ).length
  const best = visible[0] ?? null

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading executable edge analysis">
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

  if (!data.dailyVix || !data.benchmark) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6">
        <h1 className="text-xl font-bold">Edge Lab needs the daily market context</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This snapshot does not include the daily VIX, SPY benchmark, or FX series. Re-run{' '}
          <code className="rounded bg-muted px-1 py-0.5">python scripts/fetch_data.py --context-only</code>{' '}
          and reload the published data.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Target className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary">Executable event study</p>
            <h1 className="text-3xl font-bold sm:text-4xl">Edge Lab</h1>
          </div>
        </div>
        <p className="max-w-4xl text-muted-foreground">
          This is the answer to “could I have traded it?” The signal is the first daily VIX close above the
          threshold. The entry is the next observed asset close, never the same close. The exit is the next
          observed close after VIX closes below the recovery threshold, a close-based stop, or the maximum
          holding period. Returns are net of two-way costs, converted into one base currency, and measured
          against {data.benchmark.name} ({data.benchmark.ticker}), not against zero.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-muted-foreground">
            No overlapping trades
          </span>
          <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-muted-foreground">
            Benchmark-relative
          </span>
          <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-muted-foreground">
            Costs + FX included
          </span>
          <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-muted-foreground">
            Bootstrap confidence interval
          </span>
        </div>
      </header>

      <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-sm text-amber-900 dark:text-amber-100">
            <strong>Evidence, not a promise.</strong> The sample is small, trades cluster around a handful of
            volatility episodes, and the parameters are chosen with hindsight. A positive historical excess
            return is a hypothesis to test forward, not a guarantee. Position sizing, slippage, taxes, and
            discipline still decide the outcome.
          </p>
        </div>
      </section>

      <section
        className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5"
        aria-label="Edge Lab assumptions"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold">Assumptions</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            id="edge-peak"
            label="VIX entry threshold"
            value={peakThreshold}
            min={15}
            max={40}
            step={0.5}
            onChange={setPeakThreshold}
          />
          <NumberField
            id="edge-recovery"
            label="VIX recovery threshold"
            value={recoveryThreshold}
            min={10}
            max={peakThreshold}
            step={0.5}
            onChange={(value) => setRecoveryThreshold(Math.min(value, peakThreshold))}
          />
          <NumberField
            id="edge-stop"
            label="Stop loss"
            value={stopLossPct}
            min={0}
            max={50}
            step={1}
            onChange={setStopLossPct}
            suffix="%"
          />
          <NumberField
            id="edge-holding"
            label="Max holding"
            value={maxHoldingDays}
            min={0}
            max={250}
            step={5}
            onChange={setMaxHoldingDays}
            suffix="sessions"
          />
          <NumberField
            id="edge-cost"
            label="Cost per side"
            value={costBps}
            min={0}
            max={100}
            step={1}
            onChange={setCostBps}
            suffix="bps"
          />
          <label htmlFor="edge-currency" className="space-y-1 text-sm">
            <span className="font-medium">Base currency</span>
            <select
              id="edge-currency"
              value={baseCurrency}
              onChange={(event) => setBaseCurrency(event.target.value as EdgeBaseCurrency)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
          <label htmlFor="edge-from" className="space-y-1 text-sm">
            <span className="font-medium">Start date</span>
            <input
              id="edge-from"
              type="date"
              value={fromDate}
              min={availableFrom}
              max={toDate || availableTo}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="block text-xs text-muted-foreground">
              Empty = full history from {formatDate(availableFrom)}
            </span>
          </label>
          <label htmlFor="edge-to" className="space-y-1 text-sm">
            <span className="font-medium">End date</span>
            <input
              id="edge-to"
              type="date"
              value={toDate}
              min={fromDate || availableFrom}
              max={availableTo}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="block text-xs text-muted-foreground">
              Empty = latest close on {formatDate(availableTo)}
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-sm">
          <label htmlFor="edge-min-trades" className="flex items-center gap-2">
            <span className="font-medium">Minimum trades to rank</span>
            <input
              id="edge-min-trades"
              type="number"
              value={minTrades}
              min={1}
              max={30}
              step={1}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isFinite(next)) setMinTrades(Math.max(1, Math.min(30, Math.floor(next))))
              }}
              className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-right font-mono text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setPeakThreshold(21)
              setRecoveryThreshold(20)
              setStopLossPct(10)
              setMaxHoldingDays(60)
              setCostBps(10)
              setBaseCurrency('USD')
              setFromDate('')
              setToDate('')
              setMinTrades(3)
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Reset to full history
          </button>
          <span className="text-xs text-muted-foreground">
            {formatDate(fromDate || availableFrom)} – {formatDate(toDate || availableTo)} · {totalTrades}{' '}
            simulated trades across {ranked.length} assets
          </span>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Edge Lab summary">
        <StatCard
          label="Assets analysed"
          value={String(ranked.length)}
          sub={`${visible.length} meet the minimum trade count`}
        />
        <StatCard
          label="Assets with positive mean excess"
          value={`${positiveAssets} / ${visible.length || 0}`}
          valueClass={positiveAssets > 0 ? 'text-success' : 'text-muted-foreground'}
          sub="After costs, versus the benchmark"
        />
        <StatCard
          label="Best lower-bound edge"
          value={best ? best.ticker : '—'}
          valueClass="text-primary"
          sub={
            best
              ? `${formatPercent(best.ci95Low ?? best.meanExcessReturnPct)} per trade (95% lower bound)`
              : 'No asset meets the minimum'
          }
        />
        <StatCard
          label="Benchmark"
          value={data.benchmark.ticker}
          sub={`${data.benchmark.name} · USD total-return proxy`}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold">Executable ranking</h2>
            <p className="text-sm text-muted-foreground">
              Sorted by the lower bound of the 95% bootstrap interval, so lucky small samples rank lower.
              Click a row to inspect every trade.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {costBps} bps per side · stop {stopLossPct}% · max {maxHoldingDays || '∞'} sessions ·{' '}
            {baseCurrency}
          </p>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            No asset has at least {minTrades} trades with these assumptions. Lower the minimum or relax the
            thresholds.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card card-glow">
            <table className="w-full min-w-[1120px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">Rank</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">Asset</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">Trades</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">Beat SPY</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">Mean net</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">Mean excess</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">95% interval</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">t-stat</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">Profit factor</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">Mean MAE</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">Exposure</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((result, index) => (
                  <tr
                    key={result.isin}
                    onClick={() => setSelectedIsin(result.isin)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedIsin(result.isin)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Inspect ${result.ticker} executable trades`}
                    className={`cursor-pointer border-t border-border transition-colors hover:bg-muted/30 focus:outline-none focus-visible:bg-muted/40 ${
                      selected?.isin === result.isin ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="p-3 font-mono text-sm text-muted-foreground">#{index + 1}</td>
                    <td className="p-3">
                      <p className="font-semibold">{result.ticker}</p>
                      <p className="max-w-52 truncate text-xs text-muted-foreground">{result.name}</p>
                    </td>
                    <td className="p-3 text-right font-mono text-sm">{result.sampleSize}</td>
                    <td className="p-3 text-right font-mono text-sm">
                      {formatNumber(result.winRatePct, 0)}%
                    </td>
                    <td
                      className={`p-3 text-right font-mono text-sm ${returnClass(result.meanNetReturnPct)}`}
                    >
                      {formatPercent(result.meanNetReturnPct)}
                    </td>
                    <td
                      className={`p-3 text-right font-mono text-sm font-semibold ${returnClass(result.meanExcessReturnPct)}`}
                    >
                      {formatPercent(result.meanExcessReturnPct)}
                    </td>
                    <td className="p-3 text-right font-mono text-xs text-muted-foreground">
                      {formatPercent(result.ci95Low)} to {formatPercent(result.ci95High)}
                    </td>
                    <td className="p-3 text-right font-mono text-sm">{formatNumber(result.tStat, 2)}</td>
                    <td className="p-3 text-right font-mono text-sm">
                      {formatNumber(result.profitFactor, 2)}
                    </td>
                    <td className={`p-3 text-right font-mono text-sm ${returnClass(result.meanMaePct)}`}>
                      {formatPercent(result.meanMaePct)}
                    </td>
                    <td className="p-3 text-right font-mono text-sm">
                      {formatPercent(result.exposurePct, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && <ResultDetail result={selected} />}

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold">How to read the Edge Lab</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 text-sm text-muted-foreground md:grid-cols-2">
          <div className="space-y-2">
            <p className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span>
                <strong className="text-foreground">Mean excess</strong> is the average trade return minus
                what the same money would have earned in the benchmark over the identical entry-to-exit
                window. It already includes costs and FX.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <strong className="text-foreground">95% interval</strong> comes from resampling the realised
                trades. If it straddles zero, the sample does not establish a reliable edge. The ranking uses
                the lower bound for exactly that reason.
              </span>
            </p>
          </div>
          <div className="space-y-2">
            <p className="flex items-start gap-2">
              <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <span>
                <strong className="text-foreground">MAE</strong> is the worst close-based drawdown while the
                trade was open. Size positions so a normal MAE does not force you out before the thesis plays
                out.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              <span>
                <strong className="text-foreground">Do not optimise until it looks good.</strong> Changing the
                threshold, stop, and holding period until every asset wins is curve fitting. Choose rules
                first, then inspect the evidence.
              </span>
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Return convention: local adjusted closes are converted to {baseCurrency} at the entry and exit
          dates, then a {costBps} bps cost is charged on entry and again on exit. The benchmark receives the
          same treatment. This is a research approximation, not a broker fill simulation.
        </p>
      </section>

      <section
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        aria-label="Confirmation indicators and decision checklist"
      >
        <div className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5 card-glow">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="font-semibold">Confirmation indicators</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            A signal is not an entry. Before acting, check whether the rest of the market is confirming the
            same stress.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              <span>
                <strong className="text-foreground">VIX 1-day vs 5-day change.</strong> A one-day spike is
                different from a sustained five-day grind. Check whether the move is decelerating before
                entry.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <strong className="text-foreground">SPY realised volatility vs VIX.</strong> A wide
                implied-minus-realised gap means option protection is expensive; realised volatility catching
                up is the risk.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <strong className="text-foreground">Pattern outcome vs baseline.</strong> Only trust a pattern
                if its forward mean beats the baseline by more than the displayed false-match noise.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              <span>
                <strong className="text-foreground">Number of matches.</strong> Fewer than five matches is
                explicitly flagged as fragile in the app.
              </span>
            </li>
          </ul>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5 card-glow">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="font-semibold">Decision checklist</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Follow the same sequence every time so the decision does not drift with the last headline.
          </p>
          <ol className="space-y-3 text-sm">
            {[
              'Check the regime panel: is VIX genuinely stressed, and is the curve confirming it?',
              'Open Edge Lab: choose your real currency, costs, and stop. Ignore any asset whose lower confidence bound is below zero.',
              'Prefer assets with at least 5 trades, positive median excess, profit factor above 1.3, and an MAE you can sit through.',
              'Size the position so the mean MAE is an ordinary drawdown, not an account-ending one.',
              'Re-check the assumption panel at higher costs. If the edge disappears, it was never there.',
              'Paper-trade the rule forward before risking size.',
            ].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  )
}
