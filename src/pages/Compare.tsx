import { useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { useData } from '@/hooks/useData'
import { formatPercent } from '@/lib/utils'
import { X } from 'lucide-react'

export default function Compare() {
  const { data } = useData()
  const [selected, setSelected] = useState<string[]>([])

  if (!data) return null

  const toggleAsset = (isin: string) => {
    if (selected.includes(isin)) {
      setSelected(selected.filter(s => s !== isin))
    } else if (selected.length < 5) {
      setSelected([...selected, isin])
    }
  }

  const selectedAssets = data.assets.filter(a => selected.includes(a.isin))

  const colors = ['#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#a855f7']

  const option = selectedAssets.length > 0 ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'hsl(222 47% 8%)',
      borderColor: 'hsl(217 33% 17%)',
      textStyle: { color: 'hsl(210 40% 98%)' },
    },
    legend: {
      data: selectedAssets.map(a => a.ticker),
      textStyle: { color: 'hsl(210 40% 98%)' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: selectedAssets[0]?.priceSeries.dates || [],
      axisLine: { lineStyle: { color: 'hsl(217 33% 17%)' } },
      axisLabel: { color: 'hsl(215 20% 65%)' },
    },
    yAxis: {
      type: 'value',
      name: 'Indexed to 100',
      axisLine: { lineStyle: { color: 'hsl(217 33% 17%)' } },
      axisLabel: { color: 'hsl(215 20% 65%)' },
      splitLine: { lineStyle: { color: 'hsl(217 33% 17%)' } },
    },
    series: selectedAssets.map((asset, idx) => {
      const base = asset.priceSeries.price.find(p => p !== null)
      const normalized = asset.priceSeries.price.map(p => p !== null && base ? (p / base) * 100 : null)
      return {
        name: asset.ticker,
        type: 'line',
        data: normalized,
        smooth: true,
        lineStyle: { color: colors[idx], width: 2 },
        itemStyle: { color: colors[idx] },
      }
    }),
  } : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compare Assets</h1>
        <p className="text-muted-foreground">Select up to 5 assets to compare normalized performance</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedAssets.map((asset, idx) => (
          <button
            key={asset.isin}
            onClick={() => toggleAsset(asset.isin)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border"
            style={{ backgroundColor: `${colors[idx]}20`, borderColor: colors[idx] }}
          >
            <span className="font-medium">{asset.ticker}</span>
            <X className="h-4 w-4" />
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden max-h-64 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
          {data.assets.map(asset => (
            <button
              key={asset.isin}
              onClick={() => toggleAsset(asset.isin)}
              disabled={!selected.includes(asset.isin) && selected.length >= 5}
              className={`text-left p-3 rounded-lg border transition-all ${
                selected.includes(asset.isin)
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              <p className="font-semibold">{asset.ticker}</p>
              <p className="text-xs text-muted-foreground truncate">{asset.name}</p>
            </button>
          ))}
        </div>
      </div>

      {option && selectedAssets.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 card-glow">
          <ReactECharts option={option} style={{ height: '400px' }} opts={{ renderer: 'svg' }} />
        </div>
      )}

      {selectedAssets.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Asset</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Mean Change</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Max Change</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Mean Days</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Mean VIX</th>
              </tr>
            </thead>
            <tbody>
              {selectedAssets.map(asset => (
                <tr key={asset.isin} className="border-t border-border">
                  <td className="p-3">
                    <p className="font-semibold">{asset.ticker}</p>
                    <p className="text-xs text-muted-foreground">{asset.name}</p>
                  </td>
                  <td className={`p-3 text-right font-mono ${asset.summary.meanChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatPercent(asset.summary.meanChange)}
                  </td>
                  <td className={`p-3 text-right font-mono ${asset.summary.maxChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatPercent(asset.summary.maxChange)}
                  </td>
                  <td className="p-3 text-right font-mono">{asset.summary.meanDays.toFixed(0)}</td>
                  <td className="p-3 text-right font-mono">{asset.summary.meanVix.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
