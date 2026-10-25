import { FileText, Database, AlertTriangle } from 'lucide-react'

export default function About() {
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
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">1</span>
            <div>
              <strong>VIX peak</strong> = a local maximum of <code className="px-1 py-0.5 bg-muted rounded">^VIX</code> daily High where <code className="px-1 py-0.5 bg-muted rounded">High &gt; 21</code>, confirmed when <code className="px-1 py-0.5 bg-muted rounded">High[t] &gt; High[t-1]</code> AND <code className="px-1 py-0.5 bg-muted rounded">High[t] &gt; High[t+1]</code>.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">2</span>
            <div>
              <strong>Recovery date</strong> = the FIRST trading day after (or on) the peak date where <code className="px-1 py-0.5 bg-muted rounded">VIX Close &lt; 20</code>.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">3</span>
            <div><strong>Asset at peak</strong> = asset close price on the VIX peak date.</div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">4</span>
            <div><strong>Asset at recovery</strong> = asset close price on the recovery date.</div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">5</span>
            <div><strong>Percent change</strong> = (asset_at_recovery − asset_at_peak) / asset_at_peak × 100.</div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">6</span>
            <div><strong>Days to recovery</strong> = calendar days between peak date and recovery date.</div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">7</span>
            <div><strong>Per-asset summary</strong> = mean / max of percent changes, mean days, and mean VIX peak value across all peaks for that asset.</div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">8</span>
            <div><strong>Global ranking</strong> = all assets sorted descending by mean percent change.</div>
          </li>
        </ol>
        <p className="text-sm text-muted-foreground mt-4">
          If an asset has no recovery date after a peak (VIX never drops &lt; 20 in the data window), that peak is excluded from calculations and flagged in the UI.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Data Source</h2>
        </div>
        <p className="text-sm">
          Data is pre-computed and stored as static JSON in <code className="px-1 py-0.5 bg-muted rounded">public/data/vix-pulse.json</code>. 
          The included Python script (<code className="px-1 py-0.5 bg-muted rounded">scripts/fetch_data.py</code>) can regenerate the dataset using <code className="px-1 py-0.5 bg-muted rounded">yfinance</code> and <code className="px-1 py-0.5 bg-muted rounded">pandas</code> following the exact methodology above.
        </p>
        <p className="text-sm text-muted-foreground">
          The app runs 100% client-side with no backend, API keys, or external runtime calls.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <h2 className="text-xl font-bold">Disclaimer</h2>
        </div>
        <p className="text-sm font-semibold text-yellow-500">
          For research only. Not investment advice.
        </p>
        <p className="text-sm text-muted-foreground">
          This tool is provided for informational and educational purposes only. It does not constitute financial, investment, trading, or other professional advice. 
          Past performance does not guarantee future results. Always conduct your own research and consult with qualified financial professionals before making investment decisions.
        </p>
      </section>
    </div>
  )
}
