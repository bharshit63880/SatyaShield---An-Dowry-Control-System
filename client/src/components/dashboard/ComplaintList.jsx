import { useLanguage } from "../../context/LanguageContext";
import { ComplaintRiskBadge } from './ComplaintRiskBadge';
import { ComplaintStatusBadge } from './ComplaintStatusBadge';
const complaintStatuses = [{
  value: 'submitted',
  labelKey: 'visible.64900440a8c9'
}, {
  value: 'under-review',
  labelKey: 'visible.115fe4ba8ea9'
}, {
  value: 'resolved',
  labelKey: 'visible.5be3c2c8354e'
}, {
  value: 'rejected',
  labelKey: 'visible.aea4a04a8042'
}];
export function ComplaintList({
  complaints,
  filter,
  isLoading,
  onFilterChange,
  onStatusUpdate,
  updatingId
}) {
  const {
    t
  } = useLanguage();
  return <section className="surface-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">{t("visible.3f1c40e9f5fd")}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-brand-950">{t("visible.a8f728e83afd")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-600">{t("visible.7b9c2eabb031")}</p>
        </div>

        <label className="block lg:w-64">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-brand-500">{t("visible.e71a1a19361c")}</span>
          <select value={filter} onChange={event => onFilterChange(event.target.value)} className="field-input">
            <option value="all">{t("visible.8ee57323a6f2")}</option>
            {complaintStatuses.map(status => <option key={status.value} value={status.value}>
                {t(status.labelKey)}
              </option>)}
          </select>
        </label>
      </div>

      {isLoading ? <div className="mt-6 rounded-[24px] border border-brand-100 bg-brand-50 px-5 py-4 text-sm text-brand-700">{t("visible.eee971067276")}</div> : null}

      {!isLoading && !complaints.length ? <div className="mt-6 rounded-[24px] border border-brand-100 bg-brand-50 px-5 py-4 text-sm text-brand-700">{t("visible.6cc4ecb66fe6")}</div> : null}

      {!isLoading && complaints.length ? <div className="mt-6 space-y-4">
          {complaints.map(complaint => <article key={complaint.anonymousId} className="rounded-[28px] border border-brand-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_14px_40px_rgba(15,28,61,0.06)]">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-brand-500">
                      {complaint.anonymousId}
                    </p>
                    <ComplaintStatusBadge status={complaint.status} />
                    <ComplaintRiskBadge riskLevel={complaint.triage?.severity || 'moderate'} />
                  </div>

                  <p className="mt-4 text-sm leading-7 text-brand-800">
                    {complaint.description || 'No description provided.'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-brand-500">
                    <span>{t("visible.bbdffe25dc7d")}{complaint.approximateLocation || 'Not shared'}</span>
                    <span>{t("visible.f1bd0eb561db")}{new Date(complaint.timestamp).toLocaleString()}</span>
                    <span>{t("visible.f69bf9665462")}{complaint.mediaType === 'none' ? t('runtime.none') : complaint.mediaType}</span>
                    <span>{t("visible.d686a57db549")}{complaint.triage?.reviewState || 'review_required'}
                    </span>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-brand-100 bg-brand-50 px-4 py-4 text-sm text-brand-700">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-500">{t("visible.85af16ec44f8")}</p>
                    {complaint.assignedNgo ? <>
                        <p className="mt-2 font-semibold text-brand-950">{complaint.assignedNgo.name}</p>
                        <p className="mt-1">{t("visible.c79fb7487ef4")}{complaint.assignedNgo.coverageLabel}</p>
                        <p className="mt-1">{t("visible.2cf3faea3715")}{complaint.assignedNgo.matchedOn}</p>
                        <p className="mt-1">{t("visible.5705a643af6a")}{complaint.assignedNgo.contactPhone} |{' '}
                          {complaint.assignedNgo.contactEmail}
                        </p>
                      </> : <p className="mt-2">{t("visible.30ead74d21a6")}</p>}
                  </div>
                </div>

                <div className="w-full max-w-sm space-y-3">
                  <div className="rounded-[22px] border border-dashed border-brand-200 px-4 py-3 text-center text-sm text-brand-500">{t("visible.f16eca989145")}</div>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-brand-500">{t("visible.3030ddce9921")}</span>
                    <select value={complaint.status} onChange={event => onStatusUpdate(complaint.anonymousId, event.target.value)} disabled={updatingId === complaint.anonymousId} className="field-input disabled:cursor-not-allowed disabled:opacity-60">
                      {complaintStatuses.map(status => <option key={status.value} value={status.value}>
                          {t(status.labelKey)}
                        </option>)}
                    </select>
                  </label>
                </div>
              </div>
            </article>)}
        </div> : null}
    </section>;
}
