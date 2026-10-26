import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { useData } from '@/hooks/useData'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTheme } from '@/hooks/useTheme'
import { orderAssetsForNavigation } from '@/lib/assetNavigation'
import type { Asset } from '@/types'
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatShortDate,
  getChartTheme,
} from '@/lib/utils'
import { getWeeklyStats, nearestWeeklyDate } from '@/lib/vix'
import { Skeleton } from '@/components/Skeleton'

export default function AssetDetail() {
  const { isin } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { data, loading } = useData()
  const { theme } = useTheme()
  const navigationState = location.state as { assetOrder?: unknown } | null
  const preferredOrder = Array.isArray(navigationState?.assetOrder)
    ? navigationState.assetOrder.filter((value): value is string => typeof value === 'string')
    : undefined
  const orderedAssets = orderAssetsForNavigation(data?.assets ?? [], preferredOrder)
  const assetIndex = orderedAssets.findIndex((candidate) => candidate.isin === isin)
  const asset = assetIndex >= 0 ? orderedAssets[assetIndex] : undefined
  const previousAsset = assetIndex > 0 ? orderedAssets[assetIndex - 1] : null
  const nextAsset =
    assetIndex >= 0 && assetIndex < orderedAssets.length - 1 ? orderedAssets[assetIndex + 1] : null
  usePageTitle(asset ? `${asset.ticker} — ${asset.name}` : 'Asset detail')

  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastFocusedAssetRef = useRef<string | null>(null)

  useEffect(() => {
    if (!asset || lastFocusedAssetRef.current === asset.isin) return
    lastFocusedAssetRef.current = asset.isin
    window.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
  }, [asset])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive text-lg">Asset not found</p>
        <Link to="/" className="text-primary hover:underline mt-4 inline-block">
          Back to ranking
        </Link>
      </div>
    )
  }

  const validPeaks = asset.peaks.filter((p) => p.percentChange !== null)
  const meanChange =
    validPeaks.length > 0 ? validPeaks.reduce((s, p) => s + p.percentChange!, 0) / validPeaks.length : 0
  const weekly = getWeeklyStats(asset)
  const dates = asset.priceSeries.dates
  const chart = getChartTheme(theme)

  // Peak annotations are kept at their exact calculation dates in the table.
  // On the weekly chart they are anchored to the nearest week ending.
  const annotationPoints = asset.peaks
    .map((peak) => ({
      week: nearestWeeklyDate(dates, peak.vixPeakDate),
      peak,
    }))
    .filter((point): point is { week: string; peak: (typeof asset.peaks)[number] } => point.week !== null)
    .filter((point, index, all) => all.findIndex((candidate) => candidate.week === point.week) === index)

  // Every peak stays visible as a marker. Label only the largest peak in each
  // calendar year so the chart remains readable across the full six-year window.
  const yearlyLabelPoints = annotationPoints
    .reduce<Array<{ week: string; peak: (typeof asset.peaks)[number] }>>((acc, point) => {
      const year = point.week.slice(0, 4)
      const existingIndex = acc.findIndex((candidate) => candidate.week.startsWith(year))
      if (existingIndex === -1) {
        acc.push(point)
      } else if (point.peak.vixPeakValue > acc[existingIndex].peak.vixPeakValue) {
        acc[existingIndex] = point
      }
      return acc
    }, [])
    .sort((a, b) => a.week.localeCompare(b.week))
  const labelWeeks = new Set(yearlyLabelPoints.map((point) => point.week))
  const newestPeaks = [...asset.peaks].reverse()
  const peakLabelColor = theme === 'dark' ? '#fbbf24' : '#b45309'
  const vixColor = theme === 'dark' ? '#ef4444' : '#dc2626'
  const assetColor = theme === 'dark' ? '#06b6d4' : '#0e7490'
  const currentAssetNumber = assetIndex + 1

  const goToAsset = (target: Asset) => {
    navigate(`/asset/${target.isin}`, {
      state: { assetOrder: orderedAssets.map((candidate) => candidate.isin) },
    })
  }

  const option = {
    backgroundColor: 'transparent',
    animationDuration: 500,
    title: {
      text: `${asset.ticker} vs VIX`,
      subtext: `Weekly closes · through ${formatDate(data?.dateRange.to)} · ${annotationPoints.length} peak marks · largest peak each year labeled`,
      left: 0,
      top: 0,
      textStyle: { color: chart.text, fontSize: 16, fontWeight: 600 },
      subtextStyle: { color: chart.muted, fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: chart.tooltipBg,
      borderColor: chart.tooltipBorder,
      textStyle: { color: chart.text },
      axisPointer: { type: 'cross' },
    },
    legend: {
      data: ['VIX', asset.ticker],
      textStyle: { color: chart.text },
      top: 48,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '14%',
      top: 88,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: chart.border } },
      axisLabel: {
        color: chart.muted,
        hideOverlap: true,
        formatter: (value: string) => formatShortDate(value),
      },
      name: 'Week ending',
      nameLocation: 'middle',
      nameGap: 34,
      nameTextStyle: { color: chart.muted },
    },
    yAxis: [
      {
        type: 'value',
        name: 'VIX',
        nameTextStyle: { color: vixColor },
        position: 'left',
        axisLine: { lineStyle: { color: vixColor } },
        axisLabel: { color: vixColor },
        splitLine: { lineStyle: { color: chart.border } },
        scale: true,
      },
      {
        type: 'value',
        name: `${asset.ticker} (${asset.currency})`,
        nameTextStyle: { color: assetColor },
        position: 'right',
        axisLine: { lineStyle: { color: assetColor } },
        axisLabel: { color: assetColor },
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
      {
        name: 'VIX',
        type: 'line',
        yAxisIndex: 0,
        data: asset.priceSeries.vix,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: vixColor, width: 2 },
        itemStyle: { color: vixColor },
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: {
            color: peakLabelColor,
            type: 'dashed',
            width: 1,
            opacity: 0.35,
          },
          label: { show: false },
          data: yearlyLabelPoints.map((point) => ({ xAxis: point.week })),
        },
      },
      {
        name: asset.ticker,
        type: 'line',
        yAxisIndex: 1,
        data: asset.priceSeries.price,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: assetColor, width: 2 },
        itemStyle: { color: assetColor },
      },
      {
        name: 'VIX peaks',
        type: 'scatter',
        yAxisIndex: 0,
        data: annotationPoints.map(({ week, peak }) => ({
          value: [week, peak.vixPeakValue],
          peakValue: peak.vixPeakValue,
          pct: peak.percentChange,
          exactDate: peak.vixPeakDate,
          label: { show: labelWeeks.has(week) },
        })),
        symbolSize: 6,
        itemStyle: { color: peakLabelColor, borderColor: chart.border, borderWidth: 1 },
        label: {
          show: true,
          position: 'top',
          distance: 4,
          fontSize: 9,
          color: peakLabelColor,
          formatter: (params: { data: { pct: number | null; exactDate: string; peakValue: number } }) =>
            params.data.pct === null
              ? `VIX ${params.data.peakValue.toFixed(1)}`
              : `${params.data.pct >= 0 ? '+' : ''}${params.data.pct.toFixed(1)}%`,
        },
        labelLayout: { hideOverlap: true },
        tooltip: {
          trigger: 'item',
          formatter: (params: { data: { exactDate: string; peakValue: number; pct: number | null } }) =>
            `VIX peak ${params.data.peakValue.toFixed(2)}<br/>${params.data.exactDate}<br/>` +
            (params.data.pct === null
              ? 'Recovery not reached'
              : `Asset change ${params.data.pct >= 0 ? '+' : ''}${params.data.pct.toFixed(2)}%`),
        },
        z: 5,
      },
    ],
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to ranking
        </Link>

        <nav aria-label="Asset navigation" className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => previousAsset && goToAsset(previousAsset)}
            disabled={!previousAsset}
            aria-label={
              previousAsset
                ? `Previous asset: ${previousAsset.ticker}, ${previousAsset.name}`
                : 'No previous asset'
            }
            title={previousAsset ? `Previous: ${previousAsset.ticker}` : 'No previous asset'}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-muted-foreground sm:px-3"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{previousAsset?.ticker ?? 'Previous'}</span>
          </button>

          <span
            className="min-w-16 text-center text-xs font-medium tabular-nums text-muted-foreground"
            aria-live="polite"
          >
            {currentAssetNumber} / {orderedAssets.length}
          </span>

          <button
            type="button"
            onClick={() => nextAsset && goToAsset(nextAsset)}
            disabled={!nextAsset}
            aria-label={nextAsset ? `Next asset: ${nextAsset.ticker}, ${nextAsset.name}` : 'No next asset'}
            title={nextAsset ? `Next: ${nextAsset.ticker}` : 'No next asset'}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-muted-foreground sm:px-3"
          >
            <span className="hidden sm:inline">{nextAsset?.ticker ?? 'Next'}</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      </div>

      <div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl sm:text-4xl font-bold rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          {asset.ticker} - {asset.name}
        </h1>
        <p className="text-muted-foreground mt-1">
          {asset.isin} • {asset.exchange} • {asset.type.toUpperCase()} • {asset.currency}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Weekly data through {formatDate(data?.dateRange.to)} · latest close{' '}
          <span className="font-mono text-foreground">{formatCurrency(weekly.latest, asset.currency)}</span> ·
          1W{' '}
          <span className={`font-mono ${(weekly.changePct ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatPercent(weekly.changePct)}
          </span>
        </p>
        {asset.placeholder && (
          <div className="flex items-center gap-2 mt-2 text-yellow-500">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Placeholder data</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <p className="text-sm text-muted-foreground">Last Weekly Close</p>
          <p className="text-2xl font-bold font-mono">{formatCurrency(weekly.latest, asset.currency)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <p className="text-sm text-muted-foreground">1-Week Change</p>
          <p
            className={`text-2xl font-bold font-mono ${(weekly.changePct ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}
          >
            {formatPercent(weekly.changePct)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <p className="text-sm text-muted-foreground">Mean Change</p>
          <p
            className={`text-2xl font-bold font-mono ${meanChange >= 0 ? 'text-success' : 'text-destructive'}`}
          >
            {formatPercent(meanChange)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <p className="text-sm text-muted-foreground">Max Change</p>
          <p
            className={`text-2xl font-bold font-mono ${asset.summary.maxChange >= 0 ? 'text-success' : 'text-destructive'}`}
          >
            {formatPercent(asset.summary.maxChange)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <p className="text-sm text-muted-foreground">Mean Days</p>
          <p className="text-2xl font-bold font-mono">{formatNumber(asset.summary.meanDays, 0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <p className="text-sm text-muted-foreground">Mean VIX</p>
          <p className="text-2xl font-bold font-mono">{formatNumber(asset.summary.meanVix, 1)}</p>
        </div>
      </div>

      <div
        className="rounded-xl border border-border bg-card p-4 sm:p-6 card-glow"
        role="img"
        aria-label={`${asset.ticker} weekly price and VIX chart with ${annotationPoints.length} VIX peak markers`}
      >
        <ReactECharts option={option} style={{ height: '440px' }} opts={{ renderer: 'svg' }} notMerge />
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-bold">VIX Peaks Analysis</h2>
          <p className="text-xs text-muted-foreground">
            {asset.peaks.length} local VIX highs above 21 · {validPeaks.length} with a recovery below 20 ·
            most recent first
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card card-glow">
          <div className="max-h-[36rem] overflow-auto">
            <table className="w-full min-w-[840px]">
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Peak Date</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">VIX Peak</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Price at Peak</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Recovery Date</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                    Price at Recovery
                  </th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">% Change</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                    Days to Recovery
                  </th>
                </tr>
              </thead>
              <tbody>
                {newestPeaks.map((peak, idx) => (
                  <tr key={idx} className="border-t border-border">
                    <td className="p-3 font-mono">{peak.vixPeakDate}</td>
                    <td className="p-3 text-right font-mono text-red-600 dark:text-red-400">
                      {formatNumber(peak.vixPeakValue, 2)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {formatCurrency(peak.assetPriceAtPeak, asset.currency)}
                    </td>
                    <td className="p-3 font-mono">
                      {peak.vixRecoveryDate || <span className="text-yellow-500">No recovery</span>}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {peak.assetPriceAtRecovery !== null
                        ? formatCurrency(peak.assetPriceAtRecovery, asset.currency)
                        : '—'}
                    </td>
                    <td
                      className={`p-3 text-right font-mono font-semibold ${peak.percentChange !== null ? (peak.percentChange >= 0 ? 'text-success' : 'text-destructive') : 'text-yellow-500'}`}
                    >
                      {peak.percentChange !== null ? formatPercent(peak.percentChange) : 'Excluded'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {peak.daysToRecovery !== null ? peak.daysToRecovery : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
