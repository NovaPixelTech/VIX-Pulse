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
          VIX peaks are daily local highs strictly above 21 (higher than the previous and next trading-day
          highs). Recovery is the first daily VIX close below 20. Peak and recovery asset prices use the
          latest available adjusted close on or before each VIX date. If an asset market is closed, its prior
          close is used; a later close is never substituted.
        </p>
        <p className="text-sm text-muted-foreground">
          Asset Detail charts and tables use the same daily event records and selected date window. Recovery
          cycles sharing a recovery date may be grouped visually, but every individual peak contributes to the
          reported min/average/max statistics. Unrecovered events remain pending and are excluded from
          peak-to-recovery return averages.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">VIX local-peak response analysis</h2>
        </div>
        <p className="text-sm">
          The response report evaluates every daily VIX local high above 21, with recovery below 20. Its
          initial reporting period matches the supplied yfinance range (Sep 1, 2025 through Sep 14, 2026;
          yfinance&apos;s end date is exclusive) and can be edited. Baseline comparisons and moving-average
          measures use weekly closes; peak-to-recovery returns use daily closes. The table defaults to
          descending signed average peak-to-recovery return, matching the supplied comparison. The magnitude
          score ranks average absolute moves separately. Grouping is only for chart shading, not event
          averages.
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
          The 0–100 magnitude score is the cross-asset percentile of an asset&apos;s average absolute
          peak-to-recovery price move. A higher score means a larger observed move, not better performance or
          causal sensitivity to VIX. The signed average return and baseline-to-recovery P/L are separately
          reported. Green chart bands mark positive representative-cycle rebounds while VIX returns below 20;
          red bands mark zero or negative representative-cycle rebounds.
        </p>
        <p className="text-sm text-muted-foreground">
          Daily co-movement is reported separately as Pearson correlation between asset close-to-close
          percentage returns and daily VIX close point changes; its regression slope is asset return percent
          per VIX point. Only adjacent dates with real closes for both asset sessions are used, so
          forward-filled asset holidays are not counted as zero-return observations. A low absolute
          correlation means weaker historical linear co-movement in the selected period; it does not prove
          causation or future defensiveness.
        </p>
        <p className="text-sm text-muted-foreground">
          The charts include 4-week and 13-week simple moving averages. Their values and the asset&apos;s
          percentage distance from each average are summarized at peak and recovery. Minimum, average, and
          maximum values are calculated across every qualifying peak. Historical prices are Yahoo Finance
          auto-adjusted closes and may differ from Digrin or other sources.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Weekly data and VIX regimes</h2>
        </div>
        <p className="text-sm">
          Asset Detail uses aligned daily closes when the daily snapshot is available; Compare and long-range
          history use weekly Friday closes. The dashboard separately shows the latest available daily VIX and
          asset quotes with their observation dates.
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
