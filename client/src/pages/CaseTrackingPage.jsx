import { useEffect, useState, startTransition } from 'react';
import { useParams, Link } from 'react-router-dom';

import {
  getPublicComplaintRequest,
  getComplaintTimelineRequest,
  getComplaintEvidenceRequest,
  uploadComplaintEvidenceRequest,
  getChatMessagesRequest,
  sendChatMessageRequest
} from '../services/api';

export function CaseTrackingPage() {
  const { anonymousId } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [evidenceList, setEvidenceList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const [complaintRes, timelineRes, evidenceRes, chatRes] = await Promise.all([
          getPublicComplaintRequest(anonymousId),
          getComplaintTimelineRequest(anonymousId),
          getComplaintEvidenceRequest(anonymousId),
          getChatMessagesRequest(null, anonymousId)
        ]);

        if (isMounted) {
          setComplaint(complaintRes.data.complaint);
          setTimeline(timelineRes.data.history);
          setEvidenceList(evidenceRes.data.evidenceList);
          setMessages(chatRes.data.messages);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg(err.message || 'Failed to load case tracking details.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    // Poll chat messages every 10 seconds for real-time feel
    const interval = setInterval(async () => {
      try {
        const chatRes = await getChatMessagesRequest(null, anonymousId);
        if (isMounted) {
          setMessages(chatRes.data.messages);
        }
      } catch {}
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [anonymousId]);

  async function handleEvidenceUpload(e) {
    e.preventDefault();
    if (!evidenceFile) return;

    setIsUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const formData = new FormData();
    formData.append('media', evidenceFile);

    try {
      await uploadComplaintEvidenceRequest(anonymousId, formData);
      setSuccessMsg('Evidence file uploaded and sanitized successfully.');
      setEvidenceFile(null);
      // Reload evidence and timeline
      const [evidenceRes, timelineRes] = await Promise.all([
        getComplaintEvidenceRequest(anonymousId),
        getComplaintTimelineRequest(anonymousId)
      ]);
      setEvidenceList(evidenceRes.data.evidenceList);
      setTimeline(timelineRes.data.history);
      e.target.reset();
    } catch (err) {
      setErrorMsg(err.message || 'Evidence upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;

    setIsSendingChat(true);
    try {
      const response = await sendChatMessageRequest(null, anonymousId, chatInput.trim());
      const newMsg = response.data.message;
      setMessages((prev) => [...prev, newMsg]);
      setChatInput('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send chat message.');
    } finally {
      setIsSendingChat(false);
    }
  }

  if (isLoading) {
    return (
      <div className="page-shell py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-teal-500 border-r-transparent" />
        <p className="mt-4 text-brand-700">Loading case timeline details...</p>
      </div>
    );
  }

  if (errorMsg && !complaint) {
    return (
      <div className="page-shell py-12">
        <div className="surface-panel p-8 text-center max-w-xl mx-auto">
          <p className="text-xl font-semibold text-rose-700">Error Loading Case</p>
          <p className="mt-3 text-sm text-brand-600">{errorMsg}</p>
          <Link to="/" className="button-primary mt-6 inline-block">
            Go back to homepage
          </Link>
        </div>
      </div>
    );
  }

  const statusProgress = {
    submitted: 1,
    'under-review': 2,
    resolved: 3,
    rejected: 3
  };

  const currentStep = statusProgress[complaint.status] || 1;

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="mb-6">
        <Link to="/" className="text-sm font-semibold text-brand-700 hover:underline">
          &larr; Back to Home
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left Side: Milestones, Timeline, Evidence */}
        <div className="space-y-6">
          {/* Milestone Status Tracker */}
          <section className="surface-panel p-6 sm:p-8">
            <p className="eyebrow">Case Tracking Reference: {complaint.anonymousId}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brand-950">
              Investigation Progress Tracker
            </h1>

            {/* Stepper Progress Bar */}
            <div className="mt-8 relative flex items-center justify-between">
              <div className="absolute left-0 right-0 h-1 bg-brand-100 -z-10" />
              <div
                className="absolute left-0 h-1 bg-teal-500 -z-10 transition-all duration-500"
                style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
              />

              {[
                { label: 'Submitted', desc: 'Case received' },
                { label: 'Under Review', desc: 'Assigned and assessed' },
                { label: complaint.status === 'rejected' ? 'Rejected' : 'Resolved', desc: 'Finalized case' }
              ].map((step, idx) => {
                const stepNum = idx + 1;
                const isActive = stepNum <= currentStep;
                const isFinal = idx === 2;
                let stepBg = 'bg-white border-brand-200 text-brand-400';
                if (isActive) {
                  stepBg = isFinal && complaint.status === 'rejected'
                    ? 'bg-rose-500 border-rose-500 text-white'
                    : 'bg-teal-500 border-teal-500 text-white';
                }

                return (
                  <div key={step.label} className="flex flex-col items-center">
                    <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center font-bold text-sm ${stepBg}`}>
                      {stepNum}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-brand-950">{step.label}</p>
                    <p className="text-[10px] text-brand-500 hidden sm:block">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Action Log History Timeline */}
          <section className="surface-panel p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-brand-950">Case Timeline Log</h2>
            <div className="mt-6 border-l-2 border-brand-100 pl-4 space-y-6">
              {timeline.map((item) => (
                <div key={item._id} className="relative">
                  <div className="absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-teal-500" />
                  <p className="text-xs text-brand-500">
                    {new Date(item.createdAt).toLocaleString()} &bull; {item.userRole.toUpperCase()}
                  </p>
                  <p className="text-sm font-semibold text-brand-950 mt-1">{item.action.replace('_', ' ').toUpperCase()}</p>
                  <p className="text-sm text-brand-700 mt-1">{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Evidence Vault Manager */}
          <section className="surface-panel p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-brand-950">Secure Case Evidence</h2>
            <p className="mt-1 text-xs text-brand-600">
              Files uploaded here undergo EXIF metadata sanitization to protect user identities.
            </p>

            {successMsg && (
              <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                {successMsg}
              </div>
            )}

            {/* List Evidence */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {evidenceList.map((file) => (
                <div key={file._id} className="rounded-2xl border border-brand-100 p-4 bg-white/50 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500">
                        {file.category}
                      </span>
                      {file.isDuplicate && (
                        <span className="rounded bg-rose-50 border border-rose-200 text-[10px] text-rose-700 px-1 font-medium">
                          Duplicate
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-brand-900 truncate">
                      {file.originalName}
                    </p>
                    <p className="text-xs text-brand-500">
                      Size: {Math.round(file.fileSize / 1024)} KB
                    </p>
                  </div>
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 text-xs font-semibold text-teal-700 hover:underline"
                  >
                    Download File &rarr;
                  </a>
                </div>
              ))}
            </div>

            {/* Add Evidence secure form */}
            <form onSubmit={handleEvidenceUpload} className="mt-6 pt-6 border-t border-brand-100 flex flex-col sm:flex-row items-center gap-3">
              <input
                required
                type="file"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-brand-700 file:mr-4 file:rounded-full file:border-0 file:bg-brand-950 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-900"
              />
              <button
                type="submit"
                disabled={isUploading || !evidenceFile}
                className="button-primary py-2.5 px-6 shrink-0 disabled:opacity-50"
              >
                {isUploading ? 'Sanitizing...' : 'Upload Evidence'}
              </button>
            </form>
          </section>
        </div>

        {/* Right Side: NGO Details & Anonymous Chat */}
        <div className="space-y-6">
          {/* Responding NGO Card */}
          <section className="surface-panel p-6">
            <h3 className="text-lg font-bold text-brand-950">Assigned Responding NGO</h3>
            {complaint && complaint.assignedNgo && complaint.assignedNgo.ngoId ? (
              <div className="mt-4 p-4 rounded-2xl bg-teal-50/50 border border-teal-100">
                <p className="font-semibold text-brand-950 text-base">{complaint.assignedNgo.name}</p>
                <p className="text-xs text-teal-800 font-medium mt-1">Coverage: {complaint.assignedNgo.city}, {complaint.assignedNgo.district}</p>
                <div className="mt-3 pt-3 border-t border-teal-100 text-sm text-brand-700 space-y-1">
                  <p>Phone: {complaint.assignedNgo.contactPhone}</p>
                  <p>Email: {complaint.assignedNgo.contactEmail}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-brand-600 bg-brand-50 rounded-2xl p-4">
                Routing algorithm matching regional NGO coordinators...
              </p>
            )}
          </section>

          {/* Secure Anonymous Chat thread */}
          <section className="surface-panel p-6 flex flex-col h-[500px]">
            <div className="border-b border-brand-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-brand-950">Secure Chat Panel</h3>
                <p className="text-[10px] text-brand-500 uppercase tracking-wider">End-to-End Encrypted Tunnel</p>
              </div>
              <div className="rounded bg-teal-400/10 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                Connected
              </div>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-1">
              {messages.length === 0 ? (
                <p className="text-xs text-brand-600 text-center py-8">
                  No chat messages yet. Type in the box below to ask questions or send notes to assigned operators.
                </p>
              ) : (
                messages.map((msg) => {
                  const isVictim = msg.senderRole === 'victim';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${isVictim ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      <span className="text-[9px] text-brand-600 uppercase mb-0.5 px-1">
                        {isVictim ? 'You (Reporter)' : `${msg.senderName} (${msg.senderRole.toUpperCase()})`}
                      </span>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm ${
                          isVictim ? 'bg-brand-950 text-white rounded-tr-none' : 'bg-brand-50 border border-brand-100 text-brand-950 rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[8px] text-brand-500 mt-0.5 px-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input form */}
            <form onSubmit={handleSendChat} className="flex gap-2">
              <input
                required
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type secure anonymous message..."
                className="field-input py-2"
              />
              <button
                type="submit"
                disabled={isSendingChat || !chatInput.trim()}
                className="button-primary px-4 py-2 text-xs"
              >
                Send
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
