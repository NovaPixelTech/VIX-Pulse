import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { useData } from '@/hooks/useData'
import { formatNumber, formatPercent, formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/Skeleton'

export default function AssetDetail() {
  const { isin } = useParams()
  const { data, loading } = useData()

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const asset = data?.assets.find(a => a.isin === isin)

  if (!asset) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive text-lg">Asset not found</p>
        <Link to="/" className="text-primary hover:underline mt-4 inline-block">Back to ranking</Link>
      </div>
    )
  }

  const validPeaks = asset.peaks.filter(p => p.percentChange !== null)
  const meanChange = validPeaks.length > 0 ? validPeaks.reduce((s, p) => s + p.percentChange!, 0) / validPeaks.length : 0

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'hsl(222 47% 8%)',
      borderColor: 'hsl(217 33% 17%)',
      textStyle: { color: 'hsl(210 40% 98%)' },
      axisPointer: {
        type: 'cross',
      },
    },
    legend: {
      data: ['VIX', asset.ticker],
      textStyle: { color: 'hsl(210 40% 98%)' },
      top: 10,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: asset.priceSeries.dates,
      axisLine: { lineStyle: { color: 'hsl(217 33% 17%)' } },
      axisLabel: { color: 'hsl(215 20% 65%)', rotate: 45 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'VIX',
        nameTextStyle: { color: '#ef4444' },
        position: 'left',
        axisLine: { lineStyle: { color: '#ef4444' } },
        axisLabel: { color: '#ef4444' },
        splitLine: { lineStyle: { color: 'hsl(217 33% 17%)' } },
      },
      {
        type: 'value',
        name: asset.ticker,
        nameTextStyle: { color: '#06b6d4' },
        position: 'right',
        axisLine: { lineStyle: { color: '#06b6d4' } },
        axisLabel: { color: '#06b6d4' },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { type: 'slider', bottom: 0 },
      { type: 'inside' },
    ],
    series: [
      {
        name: 'VIX',
        type: 'line',
        yAxisIndex: 0,
        data: asset.priceSeries.vix,
        smooth: true,
        lineStyle: { color: '#ef4444', width: 2 },
        itemStyle: { color: '#ef4444' },
      },
      {
        name: asset.ticker,
        type: 'line',
        yAxisIndex: 1,
        data: asset.priceSeries.price,
        smooth: true,
        lineStyle: { color: '#06b6d4', width: 2 },
        itemStyle: { color: '#06b6d4' },
      },
    ],
    markLine: {
      symbol: 'none',
      lineStyle: {
        color: '#fbbf24',
        type: 'dashed',
        width: 1.5,
      },
      label: {
        show: true,
        color: '#fbbf24',
      },
      data: asset.peaks.map(peak => ({
        xAxis: peak.vixPeakDate,
        label: {
          formatter: peak.percentChange !== null ? `${peak.percentChange >= 0 ? '+' : ''}${peak.percentChange.toFixed(1)}%` : 'N/A',
          position: 'insideEndTop',
          color: peak.percentChange !== null ? (peak.percentChange >= 0 ? '#22c55e' : '#ef4444') : '#fbbf24',
        },
      })),
    },
  }

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to ranking
      </Link>

      <div>
        <h1 className="text-3xl sm:text-4xl font-bold">{asset.ticker} - {asset.name}</h1>
        <p className="text-muted-foreground mt-1">
          {asset.isin} • {asset.exchange} • {asset.type.toUpperCase()} • {asset.currency}
        </p>
        {asset.placeholder && (
          <div className="flex items-center gap-2 mt-2 text-yellow-500">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Placeholder data</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <p className="text-sm text-muted-foreground">Mean Change</p>
          <p className={`text-2xl font-bold font-mono ${meanChange >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatPercent(meanChange)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <p className="text-sm text-muted-foreground">Max Change</p>
          <p className={`text-2xl font-bold font-mono ${asset.summary.maxChange >= 0 ? 'text-success' : 'text-destructive'}`}>
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

      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 card-glow">
        <ReactECharts option={option} style={{ height: '400px' }} opts={{ renderer: 'svg' }} />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">VIX Peaks Analysis</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Peak Date</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">VIX Peak</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Price at Peak</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Recovery Date</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Price at Recovery</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">% Change</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Days to Recovery</th>
                </tr>
              </thead>
              <tbody>
                {asset.peaks.map((peak, idx) => (
                  <tr key={idx} className="border-t border-border">
                    <td className="p-3 font-mono">{peak.vixPeakDate}</td>
                    <td className="p-3 text-right font-mono text-red-400">{formatNumber(peak.vixPeakValue, 2)}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(peak.assetPriceAtPeak, asset.currency)}</td>
                    <td className="p-3 font-mono">
                      {peak.vixRecoveryDate || <span className="text-yellow-500">No recovery</span>}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {peak.assetPriceAtRecovery !== null ? formatCurrency(peak.assetPriceAtRecovery, asset.currency) : '—'}
                    </td>
                    <td className={`p-3 text-right font-mono font-semibold ${peak.percentChange !== null ? (peak.percentChange >= 0 ? 'text-success' : 'text-destructive') : 'text-yellow-500'}`}>
                      {peak.percentChange !== null ? formatPercent(peak.percentChange) : 'Excluded'}
                    </td>
                    <td className="p-3 text-right font-mono">{peak.daysToRecovery !== null ? peak.daysToRecovery : '—'}</td>
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
