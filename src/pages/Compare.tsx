import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Search, X } from 'lucide-react'
import { useData } from '@/hooks/useData'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTheme } from '@/hooks/useTheme'
import { formatCurrency, formatDate, formatPercent, formatNumber, getChartTheme } from '@/lib/utils'
import { deriveVixMetrics, getVixRegime, getWeeklyStats } from '@/lib/vix'

const MAX_ASSETS = 10
const DEFAULT_SELECTION = ['US67066G1040', 'US0378331005', 'US5949181045']
const ASSET_COLORS = [
  '#06b6d4',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#3b82f6',
  '#84cc16',
  '#f97316',
  '#14b8a6',
  '#f43f5e',
]
const LIGHT_ASSET_COLORS = [
  '#0891b2',
  '#16a34a',
  '#d97706',
  '#9333ea',
  '#db2777',
  '#2563eb',
  '#65a30d',
  '#ea580c',
  '#0d9488',
  '#e11d48',
]
const VIX_COLOR = '#ef4444'

export default function Compare() {
  const { data } = useData()
  const { theme } = useTheme()
  usePageTitle('Compare assets')
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTION)
  const [query, setQuery] = useState('')

  const filteredAssets = useMemo(() => {
    if (!data) return []
    const normalized = query.trim().toLowerCase()
    if (!normalized) return data.assets
    return data.assets.filter(
      (asset) =>
        asset.ticker.toLowerCase().includes(normalized) ||
        asset.name.toLowerCase().includes(normalized) ||
        asset.isin.toLowerCase().includes(normalized),
    )
  }, [data, query])

  if (!data) return null

  const toggleAsset = (isin: string) => {
    if (selected.includes(isin)) {
      setSelected(selected.filter((s) => s !== isin))
    } else if (selected.length < MAX_ASSETS) {
      setSelected([...selected, isin])
    }
  }

  const selectedAssets = data.assets.filter((asset) => selected.includes(asset.isin))
  const chartDates = data.assets[0]?.priceSeries.dates ?? []
  const weeklyVix = data.assets[0]?.priceSeries.vix ?? []
  const vixMetrics = deriveVixMetrics(data)
  const regime = getVixRegime(vixMetrics?.currentVix)
  const chart = getChartTheme(theme)
  const assetColors = theme === 'dark' ? ASSET_COLORS : LIGHT_ASSET_COLORS

  const option = {
    backgroundColor: 'transparent',
    animationDuration: 500,
    title: {
      text: 'Weekly performance vs. VIX',
      subtext: `Indexed to 100 at each asset's first available weekly close · through ${formatDate(data.dateRange.to)}`,
      left: 0,
      top: 0,
      textStyle: { color: chart.text, fontSize: 16, fontWeight: 600 },
      subtextStyle: { color: chart.muted, fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: chart.tooltipBg,
      borderColor: chart.tooltipBorder,
      textStyle: { color: chart.text, fontSize: 12 },
      axisPointer: { type: 'cross' },
      valueFormatter: (value: number | null) => (value === null ? '—' : formatNumber(value, 2)),
    },
    legend: {
      data: [...selectedAssets.map((asset) => asset.ticker), 'VIX'],
      textStyle: { color: chart.text },
      top: 52,
      type: 'scroll',
      itemGap: 14,
    },
    grid: {
      left: '2%',
      right: '2%',
      bottom: '14%',
      top: 105,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: chartDates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: chart.border } },
      axisLabel: { color: chart.muted, hideOverlap: true },
      name: 'Week ending',
      nameLocation: 'middle',
      nameGap: 32,
      nameTextStyle: { color: chart.muted },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Indexed to 100',
        nameTextStyle: { color: chart.muted },
        axisLine: { lineStyle: { color: chart.border } },
        axisLabel: { color: chart.muted },
        splitLine: { lineStyle: { color: chart.border } },
        scale: true,
      },
      {
        type: 'value',
        name: 'VIX',
        position: 'right',
        nameTextStyle: { color: VIX_COLOR },
        axisLine: { lineStyle: { color: VIX_COLOR } },
        axisLabel: { color: VIX_COLOR },
        splitLine: { show: false },
        scale: true,
      },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      {
        type: 'slider',
        bottom: 0,
        height: 20,
        borderColor: chart.border,
        textStyle: { color: chart.muted },
      },
    ],
    series: [
      ...selectedAssets.map((asset, idx) => {
        const firstPrice = asset.priceSeries.price.find((price) => price !== null) ?? null
        const normalized = asset.priceSeries.price.map((price) =>
          price !== null && firstPrice ? (price / firstPrice) * 100 : null,
        )
        return {
          name: asset.ticker,
          type: 'line',
          yAxisIndex: 0,
          data: normalized,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: assetColors[idx], width: 2 },
          itemStyle: { color: assetColors[idx] },
          emphasis: { focus: 'series' },
        }
      }),
      {
        name: 'VIX',
        type: 'line',
        yAxisIndex: 1,
        data: weeklyVix,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: VIX_COLOR, width: 2, type: 'dashed' },
        itemStyle: { color: VIX_COLOR },
        z: 10,
        emphasis: { focus: 'series' },
      },
    ],
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compare Assets</h1>
        <p className="text-muted-foreground">
          Select up to {MAX_ASSETS} assets. Weekly performance is shown against VIX; the table also shows the
          latest available daily quote when present.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {selectedAssets.length}/{MAX_ASSETS} selected
        </span>
        {selectedAssets.map((asset, idx) => (
          <button
            key={asset.isin}
            onClick={() => toggleAsset(asset.isin)}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-opacity hover:opacity-80"
            style={{ backgroundColor: `${assetColors[idx]}20`, borderColor: assetColors[idx] }}
            aria-label={`Remove ${asset.ticker} from comparison`}
          >
            <span className="font-medium">{asset.ticker}</span>
            <X className="h-4 w-4" />
          </button>
        ))}
        <span
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
          style={{ backgroundColor: `${VIX_COLOR}18`, borderColor: VIX_COLOR }}
          title="VIX is always included in the comparison chart"
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VIX_COLOR }} />
          <span className="font-medium">VIX</span>
          <span className="text-xs text-muted-foreground">always on</span>
        </span>
      </div>

      {vixMetrics && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm card-glow">
          <span className="font-medium">VIX benchmark</span>
          <span className="font-mono">
            {formatNumber(vixMetrics.currentVix, 2)}
            <span className="ml-1 text-xs text-muted-foreground">
              today · {formatDate(vixMetrics.currentDate)}
            </span>
          </span>
          <span
            className={`font-mono ${
              vixMetrics.changeDayPct >= 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {formatPercent(vixMetrics.changeDayPct)} today
          </span>
          <span className="font-mono text-muted-foreground">
            {formatNumber(vixMetrics.latestWeekVix, 2)}
            <span className="ml-1 text-xs">week ended {formatDate(vixMetrics.latestWeekDate)}</span>
          </span>
          <span
            className={`font-mono ${
              vixMetrics.changeWeekPct >= 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {formatPercent(vixMetrics.changeWeekPct)} 1W
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${regime.bgClass} ${regime.textClass}`}
          >
            {regime.label} · {regime.range}
          </span>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card card-glow">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search assets to add..."
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Search assets to add to comparison"
            />
          </div>
          <button
            onClick={() => setSelected([])}
            className="self-start rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:self-auto"
          >
            Clear assets
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAssets.map((asset) => {
              const active = selected.includes(asset.isin)
              const disabled = !active && selected.length >= MAX_ASSETS
              return (
                <button
                  key={asset.isin}
                  onClick={() => toggleAsset(asset.isin)}
                  disabled={disabled}
                  aria-pressed={active}
                  className={`rounded-lg border p-2.5 text-left transition-all ${
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{asset.ticker}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {asset.type}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{asset.name}</p>
                </button>
              )
            })}
          </div>
          {filteredAssets.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No assets match “{query}”.</p>
          )}
        </div>
      </div>

      <div
        className="rounded-xl border border-border bg-card p-4 sm:p-6 card-glow"
        role="img"
        aria-label={`Weekly comparison chart for ${selectedAssets.map((asset) => asset.ticker).join(', ') || 'no assets'} and VIX`}
      >
        <ReactECharts option={option} style={{ height: '520px' }} opts={{ renderer: 'svg' }} notMerge />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold">Comparison table</h2>
          <p className="text-xs text-muted-foreground">
            Latest weekly close and VIX-cycle summary per asset.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Asset</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Latest Quote</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">1D</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Last Week</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">1W</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Mean Change</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Max Change</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Mean Days</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Mean VIX</th>
              </tr>
            </thead>
            <tbody>
              {selectedAssets.map((asset, idx) => {
                const weekly = getWeeklyStats(asset)
                const latestQuote = asset.latestQuote
                return (
                  <tr key={asset.isin} className="border-t border-border">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: assetColors[idx] }}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold">{asset.ticker}</p>
                          <p className="truncate text-xs text-muted-foreground">{asset.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono">
                      {formatCurrency(latestQuote?.price ?? weekly.latest, asset.currency)}
                      <span className="block text-xs text-muted-foreground">
                        {latestQuote?.date ? formatDate(latestQuote.date) : 'weekly fallback'}
                      </span>
                    </td>
                    <td
                      className={`p-3 text-right font-mono ${
                        latestQuote?.changePct === null || latestQuote?.changePct === undefined
                          ? 'text-muted-foreground'
                          : latestQuote.changePct >= 0
                            ? 'text-success'
                            : 'text-destructive'
                      }`}
                    >
                      {formatPercent(latestQuote?.changePct)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {formatCurrency(weekly.latest, asset.currency)}
                    </td>
                    <td
                      className={`p-3 text-right font-mono ${
                        weekly.changePct === null
                          ? 'text-muted-foreground'
                          : weekly.changePct >= 0
                            ? 'text-success'
                            : 'text-destructive'
                      }`}
                    >
                      {formatPercent(weekly.changePct)}
                    </td>
                    <td
                      className={`p-3 text-right font-mono ${asset.summary.meanChange >= 0 ? 'text-success' : 'text-destructive'}`}
                    >
                      {formatPercent(asset.summary.meanChange)}
                    </td>
                    <td
                      className={`p-3 text-right font-mono ${asset.summary.maxChange >= 0 ? 'text-success' : 'text-destructive'}`}
                    >
                      {formatPercent(asset.summary.maxChange)}
                    </td>
                    <td className="p-3 text-right font-mono">{formatNumber(asset.summary.meanDays, 0)}</td>
                    <td className="p-3 text-right font-mono">{formatNumber(asset.summary.meanVix, 1)}</td>
                  </tr>
                )
              })}
              {vixMetrics && (
                <tr className="border-t border-border bg-red-500/5">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: VIX_COLOR }}
                      />
                      <div>
                        <p className="font-semibold">VIX</p>
                        <p className="text-xs text-muted-foreground">Benchmark · always included</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono">{formatNumber(vixMetrics.latestWeekVix, 2)}</td>
                  <td
                    className={`p-3 text-right font-mono ${
                      vixMetrics.changeWeekPct >= 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {formatPercent(vixMetrics.changeWeekPct)}
                  </td>
                  <td className="p-3 text-right text-muted-foreground">—</td>
                  <td className="p-3 text-right text-muted-foreground">—</td>
                  <td className="p-3 text-right text-muted-foreground">—</td>
                  <td className="p-3 text-right text-muted-foreground">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
