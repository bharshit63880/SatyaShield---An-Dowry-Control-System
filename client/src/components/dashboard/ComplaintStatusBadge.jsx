const statusClasses = {
  submitted: 'bg-trust-50 text-brand-800 ring-trust-200',
  'under-review': 'bg-amber-50 text-amber-700 ring-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200'
};

export function formatComplaintStatus(status) {
  return status.replace('-', ' ');
}

export function ComplaintStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ring-1 ${
        statusClasses[status] ?? 'bg-white text-brand-800 ring-brand-200'
      }`}
    >
      {formatComplaintStatus(status)}
    </span>
  );
}
