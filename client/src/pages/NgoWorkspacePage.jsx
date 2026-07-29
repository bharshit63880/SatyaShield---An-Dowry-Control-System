import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  acknowledgeNgoOfferRequest, getNgoAssignmentsRequest, getNgoOfferRequest,
  getNgoProfileRequest, rejectNgoOfferRequest, submitNgoProfileRequest
} from '../services/api';

export function NgoWorkspacePage() {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const load = () => Promise.all([getNgoProfileRequest(token), getNgoAssignmentsRequest(token)])
    .then(([p, a]) => { setProfile(p.data.profile); setAssignments(a.data.assignments); })
    .catch((error) => setMessage(error.message));
  useEffect(() => { load(); }, [token]);
  const act = async (fn) => {
    try { await fn(); setPreview(null); setMessage('Assignment updated safely.'); await load(); }
    catch (error) { setMessage(error.message); }
  };
  return <main className="page-shell py-10">
    <p className="eyebrow">Verified organization workspace</p>
    <h1 className="text-3xl font-bold text-white mt-2">Profile and case offers</h1>
    {message && <div className="alert-warning mt-4">{message}</div>}
    <section className="surface-card p-6 mt-6">
      <h2 className="text-xl font-semibold text-white">Verification</h2>
      <p className="text-slate-300 mt-2">Status: {profile?.verificationStatus || 'Unavailable'} · Profile version {profile?.profileVersion || '—'}</p>
      {['draft', 'changes_requested', 'rejected'].includes(profile?.verificationStatus) &&
        <button className="button-primary mt-4" onClick={() => act(() => submitNgoProfileRequest(token))}>Submit for review</button>}
      <p className="text-sm text-slate-400 mt-4">Documents are not uploaded in this phase. Registration references remain private metadata reviewed by administrators.</p>
    </section>
    <section className="surface-card p-6 mt-6">
      <h2 className="text-xl font-semibold text-white">Assignment offers</h2>
      <div className="space-y-3 mt-4">{assignments.map((item) =>
        <button key={item.assignmentId} className="w-full text-left border border-slate-700 rounded-lg p-4"
          onClick={() => getNgoOfferRequest(token, item.assignmentId).then((r) => setPreview(r.data.assignment)).catch((e) => setMessage(e.message))}>
          <span className="text-white">{item.state}</span><span className="text-slate-400"> · expires {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : '—'}</span>
        </button>)}</div>
      {preview && <div className="alert-warning mt-4">
        <p>Category: {preview.category}. Approximate area shared: {preview.approximateAreaShared ? 'yes' : 'no'}.</p>
        <div className="flex gap-3 mt-3">
          <button className="button-primary" onClick={() => act(() => acknowledgeNgoOfferRequest(token, preview.assignmentId))}>Acknowledge</button>
          <button className="button-secondary" onClick={() => act(() => rejectNgoOfferRequest(token, preview.assignmentId, 'unable_to_accept'))}>Decline</button>
        </div>
      </div>}
    </section>
  </main>;
}
