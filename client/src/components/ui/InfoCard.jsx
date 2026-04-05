export function InfoCard({ label, value, hint }) {
  return (
    <div className="surface-card p-6">
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow">{label}</p>
        <div className="h-10 w-10 rounded-2xl bg-brand-50" />
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-brand-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-brand-600">{hint}</p>
    </div>
  );
}
