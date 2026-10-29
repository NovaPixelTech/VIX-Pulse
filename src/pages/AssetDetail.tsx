import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  computePeaksForAsset,
  getAssetVixResponse,
  getMovingAverageSeries,
  VIX_RESPONSE_PEAK_THRESHOLD,
  VIX_RESPONSE_RECOVERY_THRESHOLD,
} from '@/lib/vixResponse'
import { Skeleton } from '@/components/Skeleton'
import VixResponsePanel from '@/components/VixResponsePanel'

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

  const [peakThreshold, setPeakThreshold] = useState(VIX_RESPONSE_PEAK_THRESHOLD)
  const [recoveryThreshold, setRecoveryThreshold] = useState(VIX_RESPONSE_RECOVERY_THRESHOLD)

  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastFocusedAssetRef = useRef<string | null>(null)

  useEffect(() => {
    if (!asset || lastFocusedAssetRef.current === asset.isin) return
    lastFocusedAssetRef.current = asset.isin
    window.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
  }, [asset])

  const simulatedPeaks = useMemo(
    () => (asset ? computePeaksForAsset(asset, peakThreshold, recoveryThreshold) : []),
    [asset, peakThreshold, recoveryThreshold],
  )
  const validPeaks = simulatedPeaks.filter((p) => p.percentChange !== null)
  const meanChange =
    validPeaks.length > 0 ? validPeaks.reduce((s, p) => s + p.percentChange!, 0) / validPeaks.length : 0
  const weekly = asset
    ? getWeeklyStats(asset)
    : { latest: null, previous: null, changeAbs: null, changePct: null }
  const latestQuote = asset?.latestQuote
  const dates = asset?.priceSeries.dates ?? []
  const chart = getChartTheme(theme)
  const response = useMemo(
    () =>
      asset
        ? getAssetVixResponse(asset, peakThreshold, recoveryThreshold)
        : getAssetVixResponse({} as Asset, peakThreshold, recoveryThreshold),
    [asset, peakThreshold, recoveryThreshold],
  )
  const safeResponse = asset ? response : null

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!asset || !safeResponse) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive text-lg">Asset not found</p>
        <Link to="/" className="text-primary hover:underline mt-4 inline-block">
          Back to ranking
        </Link>
      </div>
    )
  }
  const fourWeekMovingAverage = getMovingAverageSeries(asset, 4)
  const thirteenWeekMovingAverage = getMovingAverageSeries(asset, 13)
  const responseEventByDate = new Map(safeResponse.events.map((event) => [event.peakDate, event]))

  // Peak annotations are kept at their exact calculation dates in the table.
  // On the weekly chart, ordinary peaks share one marker per week; high peaks
  // retain individual markers so every VIX >25 event remains inspectable.
  const annotationPoints = simulatedPeaks.reduce<
    Array<{ week: string; peak: (typeof simulatedPeaks)[number] }>
  >((points, peak) => {
    const week = nearestWeeklyDate(dates, peak.vixPeakDate)
    if (!week) return points
    const existingIndex = points.findIndex((point) => point.week === week)
    if (existingIndex === -1) {
      points.push({ week, peak })
    } else if (peak.vixPeakValue > points[existingIndex].peak.vixPeakValue) {
      points[existingIndex] = { week, peak }
    }
    return points
  }, [])
  const highPeakPoints = simulatedPeaks
    .filter((peak) => peak.vixPeakValue > peakThreshold)
    .map((peak) => ({ week: nearestWeeklyDate(dates, peak.vixPeakDate), peak }))
    .filter((point): point is { week: string; peak: (typeof simulatedPeaks)[number] } => point.week !== null)

  // Label the largest ordinary peak in each year; all VIX >25 peaks receive
  // their own high-contrast marker and are labeled when chart space permits.
  const yearlyLabelPoints = annotationPoints
    .reduce<Array<{ week: string; peak: (typeof annotationPoints)[number]['peak'] }>>((acc, point) => {
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
  const newestPeaks = [...simulatedPeaks].reverse()
  const peakLabelColor = theme === 'dark' ? '#fbbf24' : '#b45309'
  const vixColor = theme === 'dark' ? '#ef4444' : '#dc2626'
  const assetColor = theme === 'dark' ? '#06b6d4' : '#0e7490'
  const recoveryPositiveColor = theme === 'dark' ? '#4ade80' : '#15803d'
  const recoveryNegativeColor = theme === 'dark' ? '#f87171' : '#b91c1c'
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
      subtext: `Weekly closes · through ${formatDate(data?.dateRange.to)} · ${highPeakPoints.length} VIX > ${peakThreshold.toFixed(1)} peaks · shaded recovery cycles`,
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
      type: 'scroll',
      data: ['VIX', asset.ticker, '4W MA', '13W MA', `VIX >${peakThreshold.toFixed(1)} peaks`],
      left: 0,
      right: 0,
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
        markArea: {
          silent: true,
          label: { show: false },
          data: safeResponse.cycles
            .filter((cycle) => cycle.startWeek && cycle.endWeek && cycle.representative.reboundPct !== null)
            .map((cycle) => [
              {
                xAxis: cycle.startWeek!,
                itemStyle: {
                  color:
                    cycle.positiveRecovery === true ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                },
              },
              { xAxis: cycle.endWeek! },
            ]),
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
        markPoint: {
          symbol: 'arrow',
          symbolSize: [12, 18],
          data: safeResponse.cycles
            .filter(
              (cycle) =>
                cycle.endWeek &&
                cycle.representative.recoveryPrice !== null &&
                cycle.representative.reboundPct !== null,
            )
            .map((cycle) => {
              const rebound = cycle.representative.reboundPct!
              const positive = rebound > 0
              return {
                coord: [cycle.endWeek!, cycle.representative.recoveryPrice!],
                symbolRotate: positive ? 0 : 180,
                itemStyle: { color: positive ? recoveryPositiveColor : recoveryNegativeColor },
                label: {
                  show: true,
                  position: positive ? 'top' : 'bottom',
                  formatter: `${rebound >= 0 ? '+' : ''}${rebound.toFixed(1)}%`,
                  color: positive ? recoveryPositiveColor : recoveryNegativeColor,
                  fontSize: 10,
                  fontWeight: 600,
                },
              }
            }),
          labelLayout: { hideOverlap: true },
          tooltip: {
            formatter: (params: { data: { coord: [string, number]; label: { formatter: string } } }) =>
              `Asset rebound by VIX recovery: ${params.data.label.formatter}<br/>${params.data.coord[0]}`,
          },
        },
      },
      {
        name: '4W MA',
        type: 'line',
        yAxisIndex: 1,
        data: fourWeekMovingAverage,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { color: theme === 'dark' ? '#fbbf24' : '#b45309', width: 1.5, type: 'dashed' },
        itemStyle: { color: theme === 'dark' ? '#fbbf24' : '#b45309' },
      },
      {
        name: '13W MA',
        type: 'line',
        yAxisIndex: 1,
        data: thirteenWeekMovingAverage,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { color: theme === 'dark' ? '#c4b5fd' : '#6d28d9', width: 1.5, type: 'dashed' },
        itemStyle: { color: theme === 'dark' ? '#c4b5fd' : '#6d28d9' },
      },
      {
        name: 'VIX peaks',
        type: 'scatter',
        yAxisIndex: 0,
        data: annotationPoints
          .filter(({ peak }) => peak.vixPeakValue <= peakThreshold)
          .map(({ week, peak }) => ({
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
          formatter: (params: { data: { exactDate: string; peakValue: number } }) =>
            `VIX ${params.data.peakValue.toFixed(1)}`,
        },
        labelLayout: { hideOverlap: true },
        tooltip: {
          trigger: 'item',
          formatter: (params: { data: { exactDate: string; peakValue: number; pct: number | null } }) =>
            `VIX peak ${params.data.peakValue.toFixed(2)}<br/>${params.data.exactDate}<br/>` +
            (params.data.pct === null
              ? 'Recovery not reached'
              : `Asset change by recovery: ${params.data.pct >= 0 ? '+' : ''}${params.data.pct.toFixed(2)}%`),
        },
        z: 5,
      },
      {
        name: `VIX >${peakThreshold.toFixed(1)} peaks`,
        type: 'scatter',
        yAxisIndex: 0,
        data: highPeakPoints.map(({ week, peak }) => ({
          value: [week, peak.vixPeakValue],
          peakValue: peak.vixPeakValue,
          stressMove: responseEventByDate.get(peak.vixPeakDate)?.stressChangePct ?? null,
          rebound: responseEventByDate.get(peak.vixPeakDate)?.reboundPct ?? null,
          vixRise: responseEventByDate.get(peak.vixPeakDate)?.vixRisePoints ?? null,
          exactDate: peak.vixPeakDate,
        })),
        symbol: 'diamond',
        symbolSize: 9,
        itemStyle: {
          color: theme === 'dark' ? '#fb7185' : '#b91c1c',
          borderColor: chart.border,
          borderWidth: 1,
        },
        label: {
          show: true,
          position: 'top',
          distance: 4,
          fontSize: 8,
          color: theme === 'dark' ? '#fda4af' : '#991b1b',
          formatter: (params: { data: { peakValue: number } }) => `VIX ${params.data.peakValue.toFixed(1)}`,
        },
        labelLayout: { hideOverlap: true },
        tooltip: {
          trigger: 'item',
          formatter: (params: {
            data: {
              exactDate: string
              peakValue: number
              stressMove: number | null
              rebound: number | null
              vixRise: number | null
            }
          }) => {
            const { data: point } = params
            const formatChange = (value: number | null) =>
              value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
            return (
              `VIX peak ${point.peakValue.toFixed(2)}<br/>${point.exactDate}<br/>` +
              `VIX rise from prior weekly close: ${point.vixRise === null ? '—' : `${point.vixRise.toFixed(2)} pts`}<br/>` +
              `Asset stress move: ${formatChange(point.stressMove)}<br/>` +
              `Asset rebound by VIX recovery: ${formatChange(point.rebound)}`
            )
          },
        },
        z: 6,
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
        <p className="mt-2 text-sm text-muted-foreground">
          Latest quote{' '}
          <span className="font-mono text-foreground">
            {formatCurrency(latestQuote?.price ?? weekly.latest, asset.currency)}
          </span>
          {' · '}
          {latestQuote?.date ? formatDate(latestQuote.date) : 'weekly fallback'}
          {' · 1D '}
          <span
            className={`font-mono ${
              latestQuote?.changePct === null || latestQuote?.changePct === undefined
                ? 'text-muted-foreground'
                : latestQuote.changePct >= 0
                  ? 'text-success'
                  : 'text-destructive'
            }`}
          >
            {formatPercent(latestQuote?.changePct)}
          </span>
          {' · weekly history through '}
          <span className="font-mono">{formatDate(data?.dateRange.to)}</span>
          {' · 1W '}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <p className="text-sm text-muted-foreground">Latest Available Price</p>
          <p className="text-2xl font-bold font-mono">
            {formatCurrency(latestQuote?.price ?? weekly.latest, asset.currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            {latestQuote?.date ? formatDate(latestQuote.date) : 'Weekly fallback'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <p className="text-sm text-muted-foreground">Daily Change</p>
          <p
            className={`text-2xl font-bold font-mono ${
              latestQuote?.changePct === null || latestQuote?.changePct === undefined
                ? 'text-muted-foreground'
                : latestQuote.changePct >= 0
                  ? 'text-success'
                  : 'text-destructive'
            }`}
          >
            {formatPercent(latestQuote?.changePct)}
          </p>
        </div>
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
        aria-label={`${asset.ticker} weekly price and VIX chart with ${highPeakPoints.length} VIX peaks above ${peakThreshold}, ${safeResponse.cycles.length} grouped recovery cycles, and 4-week and 13-week moving averages`}
      >
        <ReactECharts option={option} style={{ height: '480px' }} opts={{ renderer: 'svg' }} notMerge />
      </div>
      <div
        className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
        aria-label="Chart annotation guide"
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-4 rounded-sm bg-green-500/20" aria-hidden="true" />
          Green: asset rose while VIX returned below {recoveryThreshold}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-4 rounded-sm bg-red-500/20" aria-hidden="true" />
          Red: asset did not rise during VIX normalization
        </span>
        <span>Arrows show peak-to-recovery asset change; dashed lines show 4W and 13W averages.</span>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 card-glow space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Interactive VIX Stress Test</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Adjust the peak and recovery thresholds to simulate how the analysis changes in real time. The
              chart, response panel, and table below update instantly.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="space-y-2 min-w-[240px]">
              <div className="flex items-center justify-between">
                <label htmlFor="peak-threshold" className="font-medium">
                  VIX peak threshold
                </label>
                <span className="font-mono text-muted-foreground">{peakThreshold.toFixed(1)}</span>
              </div>
              <input
                id="peak-threshold"
                type="range"
                min={15}
                max={40}
                step={0.5}
                value={peakThreshold}
                onChange={(e) => setPeakThreshold(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Peaks detected when weekly VIX is above this value.
              </p>
            </div>
            <div className="space-y-2 min-w-[240px]">
              <div className="flex items-center justify-between">
                <label htmlFor="recovery-threshold" className="font-medium">
                  VIX recovery threshold
                </label>
                <span className="font-mono text-muted-foreground">{recoveryThreshold.toFixed(1)}</span>
              </div>
              <input
                id="recovery-threshold"
                type="range"
                min={12}
                max={peakThreshold}
                step={0.5}
                value={Math.min(recoveryThreshold, peakThreshold)}
                onChange={(e) => setRecoveryThreshold(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Recovery is the first week VIX falls below this value.
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-background/50 p-3">
            <p className="text-xs text-muted-foreground">Simulated peaks</p>
            <p className="mt-1 text-xl font-bold font-mono">{simulatedPeaks.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-background/50 p-3">
            <p className="text-xs text-muted-foreground">Peaks with recovery</p>
            <p className="mt-1 text-xl font-bold font-mono">{response.recoveredCycleCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-background/50 p-3">
            <p className="text-xs text-muted-foreground">Positive recoveries</p>
            <p className="mt-1 text-xl font-bold font-mono">{response.positiveRecoveryCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-background/50 p-3">
            <p className="text-xs text-muted-foreground">Positive recovery rate</p>
            <p className="mt-1 text-xl font-bold font-mono">
              {response.positiveRecoveryRatePct === null
                ? '—'
                : `${response.positiveRecoveryRatePct.toFixed(1)}%`}
            </p>
          </div>
        </div>
      </div>

      <VixResponsePanel response={safeResponse} currency={asset.currency} />

      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 card-glow space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">Simple Explanation of All Factors & Indicators</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Plain-English definitions for rookies, with formulas and how each metric is calculated for this
              asset.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
            <h3 className="font-semibold">VIX Stress Test Controls</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Peak threshold (VIX):</span> A local VIX high is
                counted as a “stress peak” if VIX is above this value and higher than the week before/after.
              </li>
              <li>
                <span className="font-medium text-foreground">Recovery threshold (VIX):</span> The cycle ends
                at the first week when VIX falls below this value. If it never happens, the peak is marked as
                unrecovered.
              </li>
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
            <h3 className="font-semibold">Timing & Baseline</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Baseline date/price:</span> The last weekly
                close before the VIX peak with valid price data.
              </li>
              <li>
                <span className="font-medium text-foreground">Days to VIX recovery:</span> Calendar days from
                peak date to recovery date (based on the peak/recovery thresholds).
              </li>
              <li>
                <span className="font-medium text-foreground">Days to baseline recovery:</span> Days until the
                asset price returns to or above the baseline price after a drawdown.
              </li>
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
            <h3 className="font-semibold">Drawdown & Response</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">VIX rise (pts/%):</span> How much VIX increased
                from baseline to peak (pts = peak VIX - baseline VIX).
              </li>
              <li>
                <span className="font-medium text-foreground">Stress change / drawdown:</span> Asset move from
                baseline to peak. Drawdown % = max(0, - (peak/baseline-1)*100).
              </li>
              <li>
                <span className="font-medium text-foreground">Response ratio:</span> (Stress change %) ÷ (VIX
                rise pts). A lower (more negative) ratio often means larger drop per point of VIX.
              </li>
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
            <h3 className="font-semibold">Recovery & Averages</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Rebound %:</span> (Price at recovery / Price at
                peak - 1)*100. &gt;0 means the asset rose from its peak level by VIX recovery.
              </li>
              <li>
                <span className="font-medium text-foreground">Cycle return %:</span> (Price at recovery /
                Baseline price - 1)*100. Shows total return from baseline through recovery.
              </li>
              <li>
                <span className="font-medium text-foreground">4W/13W MA & vs MA:</span> Simple moving averages
                of weekly closes; “price vs MA %” = (price/MA - 1)*100 (above MA = positive).
              </li>
            </ul>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
          <h3 className="font-semibold">Current simulated values for this asset</h3>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center justify-between rounded border border-border/70 px-2 py-1">
              <span className="text-muted-foreground">Mean drawdown</span>
              <span className="font-mono">
                {safeResponse.stats.drawdownPct.average === null
                  ? '—'
                  : `${safeResponse.stats.drawdownPct.average.toFixed(2)}%`}
              </span>
            </div>
            <div className="flex items-center justify-between rounded border border-border/70 px-2 py-1">
              <span className="text-muted-foreground">Mean rebound</span>
              <span className="font-mono">
                {safeResponse.stats.reboundPct.average === null
                  ? '—'
                  : `${safeResponse.stats.reboundPct.average >= 0 ? '+' : ''}${safeResponse.stats.reboundPct.average.toFixed(2)}%`}
              </span>
            </div>
            <div className="flex items-center justify-between rounded border border-border/70 px-2 py-1">
              <span className="text-muted-foreground">Mean cycle return</span>
              <span className="font-mono">
                {safeResponse.stats.cycleReturnPct.average === null
                  ? '—'
                  : `${safeResponse.stats.cycleReturnPct.average >= 0 ? '+' : ''}${safeResponse.stats.cycleReturnPct.average.toFixed(2)}%`}
              </span>
            </div>
            <div className="flex items-center justify-between rounded border border-border/70 px-2 py-1">
              <span className="text-muted-foreground">Mean days to VIX recovery</span>
              <span className="font-mono">
                {safeResponse.stats.daysToVixRecovery.average === null
                  ? '—'
                  : `${safeResponse.stats.daysToVixRecovery.average.toFixed(1)}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-bold">VIX Peaks Analysis (Simulated)</h2>
          <p className="text-xs text-muted-foreground">
            {simulatedPeaks.length} peaks above {peakThreshold.toFixed(1)} · {validPeaks.length} with a
            recovery below {Math.min(recoveryThreshold, peakThreshold).toFixed(1)} · most recent first
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
