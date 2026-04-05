function TrendChart({ data }) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="surface-card p-6">
      <p className="eyebrow">Complaint Trend</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-brand-950">Last 7 days</h2>
      <div className="mt-6">
        <div className="flex h-56 items-end gap-3">
          {data.map((item) => (
            <div key={item.date} className="flex flex-1 flex-col items-center gap-3">
              <div className="text-xs font-semibold text-brand-500">{item.count}</div>
              <div className="flex h-40 w-full items-end rounded-full bg-brand-50 px-1 pb-1">
                <div
                  className="w-full rounded-full bg-[linear-gradient(180deg,#3d96ef_0%,#18aaa2_100%)]"
                  style={{
                    height: `${Math.max((item.count / maxCount) * 100, item.count ? 14 : 6)}%`
                  }}
                />
              </div>
              <div className="text-xs uppercase tracking-[0.16em] text-brand-400">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BreakdownChart({ title, data, colorClass }) {
  const entries = Object.entries(data);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;

  return (
    <div className="surface-card p-6">
      <p className="eyebrow">{title}</p>
      <div className="mt-5 space-y-4">
        {entries.map(([label, value]) => (
          <div key={label}>
            <div className="flex items-center justify-between text-sm text-brand-700">
              <span className="capitalize">{label.replace('-', ' ')}</span>
              <span className="font-semibold text-brand-950">{value}</span>
            </div>
            <div className="mt-2 h-3 rounded-full bg-brand-50">
              <div
                className={`h-3 rounded-full ${colorClass}`}
                style={{ width: `${(value / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPanels({ trend, statusSummary, riskSummary }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
      <TrendChart data={trend} />
      <div className="grid gap-6">
        <BreakdownChart
          title="Status Breakdown"
          data={statusSummary}
          colorClass="bg-[linear-gradient(90deg,#3d96ef_0%,#18aaa2_100%)]"
        />
        <BreakdownChart
          title="Risk Breakdown"
          data={riskSummary}
          colorClass="bg-[linear-gradient(90deg,#ef4444_0%,#f59e0b_55%,#10b981_100%)]"
        />
      </div>
    </section>
  );
}
