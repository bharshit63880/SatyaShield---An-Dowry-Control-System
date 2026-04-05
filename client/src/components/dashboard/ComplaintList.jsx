import { ComplaintRiskBadge } from './ComplaintRiskBadge';
import { ComplaintStatusBadge } from './ComplaintStatusBadge';

const complaintStatuses = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under-review', label: 'Under Review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' }
];

export function ComplaintList({
  complaints,
  filter,
  isLoading,
  onFilterChange,
  onStatusUpdate,
  updatingId
}) {
  return (
    <section className="surface-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Complaints</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-brand-950">
            Inbox and case workflow
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-600">
            Filter by status, open submitted evidence, and update the complaint lifecycle without
            exposing personal identity.
          </p>
        </div>

        <label className="block lg:w-64">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-brand-500">
            Filter by Status
          </span>
          <select
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            className="field-input"
          >
            <option value="all">All statuses</option>
            {complaintStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="mt-6 rounded-[24px] border border-brand-100 bg-brand-50 px-5 py-4 text-sm text-brand-700">
          Loading complaints...
        </div>
      ) : null}

      {!isLoading && !complaints.length ? (
        <div className="mt-6 rounded-[24px] border border-brand-100 bg-brand-50 px-5 py-4 text-sm text-brand-700">
          No complaints found for this filter.
        </div>
      ) : null}

      {!isLoading && complaints.length ? (
        <div className="mt-6 space-y-4">
          {complaints.map((complaint) => (
            <article
              key={complaint.anonymousId}
              className="rounded-[28px] border border-brand-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_14px_40px_rgba(15,28,61,0.06)]"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-brand-500">
                      {complaint.anonymousId}
                    </p>
                    <ComplaintStatusBadge status={complaint.status} />
                    <ComplaintRiskBadge
                      riskLevel={complaint.riskLevel}
                      riskScore={complaint.riskScore}
                    />
                  </div>

                  <p className="mt-4 text-sm leading-7 text-brand-800">
                    {complaint.description || 'No description provided.'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-brand-500">
                    <span>Location: {complaint.approximateLocation || 'Not shared'}</span>
                    <span>Submitted: {new Date(complaint.timestamp).toLocaleString()}</span>
                    <span>Media: {complaint.mediaType === 'none' ? 'None' : complaint.mediaType}</span>
                    <span>
                      Keywords:{' '}
                      {complaint.detectedKeywords?.length
                        ? complaint.detectedKeywords.join(', ')
                        : 'None'}
                    </span>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-brand-100 bg-brand-50 px-4 py-4 text-sm text-brand-700">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-500">
                      Assigned NGO
                    </p>
                    {complaint.assignedNgo ? (
                      <>
                        <p className="mt-2 font-semibold text-brand-950">{complaint.assignedNgo.name}</p>
                        <p className="mt-1">Coverage: {complaint.assignedNgo.coverageLabel}</p>
                        <p className="mt-1">Match type: {complaint.assignedNgo.matchedOn}</p>
                        <p className="mt-1">
                          Contact: {complaint.assignedNgo.contactPhone} |{' '}
                          {complaint.assignedNgo.contactEmail}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2">No NGO assigned yet.</p>
                    )}
                  </div>
                </div>

                <div className="w-full max-w-sm space-y-3">
                  {complaint.mediaUrl ? (
                    <a
                      href={complaint.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="button-secondary flex w-full"
                    >
                      View media
                    </a>
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-brand-200 px-4 py-3 text-center text-sm text-brand-500">
                      No media attached
                    </div>
                  )}

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-brand-500">
                      Update Status
                    </span>
                    <select
                      value={complaint.status}
                      onChange={(event) => onStatusUpdate(complaint.anonymousId, event.target.value)}
                      disabled={updatingId === complaint.anonymousId}
                      className="field-input disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {complaintStatuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
