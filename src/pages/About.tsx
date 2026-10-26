import { FileText, Database, AlertTriangle } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function About() {
  usePageTitle('About and methodology')
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">About VIX Pulse</h1>
        <p className="text-muted-foreground">Methodology, data sources, and disclaimers</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Methodology</h2>
        </div>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              1
            </span>
            <div>
              <strong>VIX peak</strong> = a local maximum of{' '}
              <code className="px-1 py-0.5 bg-muted rounded">^VIX</code> daily High where{' '}
              <code className="px-1 py-0.5 bg-muted rounded">High &gt; 21</code>, confirmed when{' '}
              <code className="px-1 py-0.5 bg-muted rounded">High[t] &gt; High[t-1]</code> AND{' '}
              <code className="px-1 py-0.5 bg-muted rounded">High[t] &gt; High[t+1]</code>.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              2
            </span>
            <div>
              <strong>Recovery date</strong> = the FIRST trading day after (or on) the peak date where{' '}
              <code className="px-1 py-0.5 bg-muted rounded">VIX Close &lt; 20</code>.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              3
            </span>
            <div>
              <strong>Asset at peak</strong> = asset close price on the VIX peak date.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              4
            </span>
            <div>
              <strong>Asset at recovery</strong> = asset close price on the recovery date.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              5
            </span>
            <div>
              <strong>Percent change</strong> = (asset_at_recovery − asset_at_peak) / asset_at_peak × 100.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              6
            </span>
            <div>
              <strong>Days to recovery</strong> = calendar days between peak date and recovery date.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              7
            </span>
            <div>
              <strong>Per-asset summary</strong> = mean / max of percent changes, mean days, and mean VIX peak
              value across all peaks for that asset.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              8
            </span>
            <div>
              <strong>Global ranking</strong> = all assets sorted descending by mean percent change.
            </div>
          </li>
        </ol>
        <p className="text-sm text-muted-foreground mt-4">
          Peak detection and recovery percentages use daily data: VIX intraday Highs identify peaks, while
          recovery and asset values use closing prices. The charts use Friday week-ending closes, so a daily
          peak date is displayed at its nearest week ending on the chart while the table keeps the exact daily
          date.
        </p>
        <p className="text-sm text-muted-foreground">
          The original peak-recovery summary excludes peaks without a VIX close below 20. The VIX Response
          page keeps an unresolved stress cycle as pending, displays available peak measurements, and does not
          shade it until recovery data is available.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">VIX &gt;25 sensitivity response</h2>
        </div>
        <p className="text-sm">
          The Response page evaluates VIX local peaks above 25. The baseline is the last available weekly
          asset close before each peak. Peaks sharing a VIX recovery date are grouped as one cycle for ranking
          and chart shading; the highest VIX peak represents that cycle. Asset Detail still lists every
          individual peak above 25.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            <strong>Stress move</strong> = (asset price at VIX peak / baseline price − 1) × 100.
          </li>
          <li>
            <strong>Rebound</strong> = (asset price at VIX recovery / price at peak − 1) × 100.
          </li>
          <li>
            <strong>Cycle profit/loss</strong> = (asset price at VIX recovery / baseline price − 1) × 100.
          </li>
          <li>
            <strong>VIX response ratio</strong> = stress-period asset percentage move / VIX rise in points.
            Both underlying changes are shown beside the ratio.
          </li>
          <li>
            <strong>Baseline recovery time</strong> is the number of days to the first weekly close at or
            above the pre-peak baseline, measured within the VIX recovery window.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          The 0–100 sensitivity score is the equal-weight average of cross-asset percentile ranks for average
          peak drawdown depth, average rebound, positive-rebound consistency, and baseline recovery speed.
          Faster baseline recovery ranks higher; speed is estimated from weekly closes, and missing component
          data scores zero. Green chart bands mark positive rebounds while VIX returns below 20; red bands
          mark a zero or negative rebound. Unrecovered VIX cycles are left unshaded until recovery data is
          available.
        </p>
        <p className="text-sm text-muted-foreground">
          The charts include 4-week and 13-week simple moving averages. Their values and the asset&apos;s
          percentage distance from each average are summarized at peak and recovery. Minimum, average, and
          maximum values are calculated from one representative peak per grouped cycle; the detail event table
          preserves every VIX &gt;25 local peak.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Weekly data and VIX regimes</h2>
        </div>
        <p className="text-sm">
          All time-series charts use weekly closes (Friday week ending). Asset and VIX series share the same
          week-ending date axis, and every series ends at the latest fully completed week. The main dashboard
          also shows the latest daily VIX quote with its move versus the previous trading day.
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
            <p className="font-semibold text-sky-700 dark:text-sky-400">Low</p>
            <p className="font-mono text-xs text-muted-foreground">VIX &lt; 15</p>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">Normal</p>
            <p className="font-mono text-xs text-muted-foreground">15 ≤ VIX &lt; 20</p>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="font-semibold text-amber-700 dark:text-amber-400">Elevated</p>
            <p className="font-mono text-xs text-muted-foreground">20 ≤ VIX &lt; 30</p>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="font-semibold text-red-600 dark:text-red-400">High</p>
            <p className="font-mono text-xs text-muted-foreground">VIX ≥ 30</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          The Compare page accepts up to ten assets. VIX is always plotted on a second axis and cannot be
          removed, so every asset comparison includes a volatility benchmark. VIX increases are shown in red
          and decreases in green, the inverse of asset performance colours.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Data Source</h2>
        </div>
        <p className="text-sm">
          Data is pre-computed from Yahoo Finance using{' '}
          <code className="px-1 py-0.5 bg-muted rounded">yfinance</code> and stored as static JSON in{' '}
          <code className="px-1 py-0.5 bg-muted rounded">public/data/vix-pulse.json</code>. The included
          Python script (<code className="px-1 py-0.5 bg-muted rounded">scripts/fetch_data.py</code>)
          regenerates all 66 assets and VIX series following the methodology above.
        </p>
        <p className="text-sm text-muted-foreground">
          Prices retain each security&apos;s quote currency. London-listed instruments quoted in pence are
          normalised to pounds so values and currency labels stay consistent. The app runs 100% client-side
          with no backend, API keys, or external runtime calls.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <h2 className="text-xl font-bold">Disclaimer</h2>
        </div>
        <p className="text-sm font-semibold text-yellow-500">For research only. Not investment advice.</p>
        <p className="text-sm text-muted-foreground">
          This tool is provided for informational and educational purposes only. It does not constitute
          financial, investment, trading, or other professional advice. Past performance does not guarantee
          future results. Always conduct your own research and consult with qualified financial professionals
          before making investment decisions.
        </p>
      </section>
    </div>
  )
}
