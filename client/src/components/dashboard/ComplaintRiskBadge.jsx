const riskClasses = {
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  high: 'bg-rose-50 text-rose-700 ring-rose-200'
};

export function formatRiskLevel(riskLevel) {
  return riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1);
}

export function ComplaintRiskBadge({ riskLevel, riskScore }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ring-1 ${
        riskClasses[riskLevel] ?? 'bg-white text-brand-800 ring-brand-200'
      }`}
    >
      {formatRiskLevel(riskLevel)} Risk {typeof riskScore === 'number' ? `(${riskScore})` : ''}
    </span>
  );
}
