import { useLanguage } from "../context/LanguageContext";
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { acknowledgeNgoOfferRequest, getNgoAssignmentsRequest, getNgoOfferRequest, getNgoProfileRequest, rejectNgoOfferRequest, submitNgoProfileRequest } from '../services/api';
export function NgoWorkspacePage() {
  const {
    t
  } = useLanguage();
  const {
    token
  } = useAuth();
  const [profile, setProfile] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const load = () => Promise.all([getNgoProfileRequest(token), getNgoAssignmentsRequest(token)]).then(([p, a]) => {
    setProfile(p.data.profile);
    setAssignments(a.data.assignments);
  }).catch(() => setMessage(t('runtime.genericRequestFailed')));
  useEffect(() => {
    load();
  }, [token]);
  const act = async fn => {
    try {
      await fn();
      setPreview(null);
      setMessage(t('runtime.assignmentUpdated'));
      await load();
    } catch (error) {
      setMessage(t('runtime.genericRequestFailed'));
    }
  };
  return <main className="page-shell py-10">
    <p className="eyebrow">{t("visible.2c7f2be93ce9")}</p>
    <h1 className="text-3xl font-bold text-white mt-2">{t("visible.810472142406")}</h1>
    {message && <div className="alert-warning mt-4">{message}</div>}
    <section className="surface-card p-6 mt-6">
      <h2 className="text-xl font-semibold text-white">{t("visible.7140f4f19dec")}</h2>
      <p className="text-slate-300 mt-2">{t("visible.755c8b2a9fb1")}{profile?.verificationStatus || 'Unavailable'}{t("visible.c30b9591e0dd")}{profile?.profileVersion || '—'}</p>
      {['draft', 'changes_requested', 'rejected'].includes(profile?.verificationStatus) && <button className="button-primary mt-4" onClick={() => act(() => submitNgoProfileRequest(token))}>{t("visible.40447e4493fb")}</button>}
      <p className="text-sm text-slate-400 mt-4">{t("visible.1fe477c96262")}</p>
    </section>
    <section className="surface-card p-6 mt-6">
      <h2 className="text-xl font-semibold text-white">{t("visible.b32cfc0a65bd")}</h2>
      <div className="space-y-3 mt-4">{assignments.map(item => <button key={item.assignmentId} className="w-full text-left border border-slate-700 rounded-lg p-4" onClick={() => getNgoOfferRequest(token, item.assignmentId).then(r => setPreview(r.data.assignment)).catch(() => setMessage(t('runtime.genericRequestFailed')))}>
          <span className="text-white">{item.state}</span><span className="text-slate-400">{t("visible.1de5fe01e955")}{item.expiresAt ? new Date(item.expiresAt).toLocaleString() : '—'}</span>
        </button>)}</div>
      {preview && <div className="alert-warning mt-4">
        <p>{t("visible.b330d6701b55")}{preview.category}{t("visible.3cca87ea23d7")}{preview.approximateAreaShared ? t('runtime.yes') : t('runtime.no')}.</p>
        <div className="flex gap-3 mt-3">
          <button className="button-primary" onClick={() => act(() => acknowledgeNgoOfferRequest(token, preview.assignmentId))}>{t("visible.f9236d9e87b6")}</button>
          <button className="button-secondary" onClick={() => act(() => rejectNgoOfferRequest(token, preview.assignmentId, 'unable_to_accept'))}>{t("visible.a2d285b35287")}</button>
        </div>
      </div>}
    </section>
  </main>;
}
