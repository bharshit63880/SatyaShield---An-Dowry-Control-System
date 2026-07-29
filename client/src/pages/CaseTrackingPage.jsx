import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import {
  exchangeReporterAccessRequest,
  downloadComplaintEvidenceRequest,
  getChatMessagesRequest,
  getComplaintEvidenceRequest,
  getComplaintTimelineRequest,
  getComplaintTriageRequest,
  getPublicComplaintRequest,
  sendChatMessageRequest,
  startSosConfirmationRequest,
  cancelSosRequest,
  activateSosRequest,
  getCurrentSosRequest,
  getVerifiedHelplinesRequest,
  uploadComplaintEvidenceRequest
} from '../services/api';
import {
  createCaseChatSocket, sendRealtimeMessage
} from '../services/realtime-chat';
import { useLanguage } from '../context/LanguageContext';
import { useReporterInactivityLock } from '../hooks/useReporterInactivityLock';
import { AccessibleDialog } from '../components/ui/AccessibleDialog';

const initialCredentials = { caseId: '', accessSecret: '' };
const CRITICAL_SAFETY_GUIDANCE =
  'If you or someone else may be in immediate danger, move to a safer place if you can and contact the appropriate local emergency service or a trusted person. SatyaShield does not automatically contact police, ambulance services or emergency responders.';

export function CaseTrackingPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const { anonymousId = '' } = useParams();
  const [credentials, setCredentials] = useState({
    ...initialCredentials,
    caseId: location.state?.caseId || anonymousId
  });
  const [caseId, setCaseId] = useState('');
  const [reporterToken, setReporterToken] = useState(null);
  const [complaint, setComplaint] = useState(null);
  const [triage, setTriage] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [evidenceList, setEvidenceList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [downloadingEvidenceId, setDownloadingEvidenceId] = useState(null);
  const [errorState, setErrorState] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [chatConnectionState, setChatConnectionState] = useState('closed');
  const [sos, setSos] = useState(null);
  const [showSosConfirmation, setShowSosConfirmation] = useState(false);
  const [sosNoticeAccepted, setSosNoticeAccepted] = useState(false);
  const [shareOneTimeLocation, setShareOneTimeLocation] = useState(false);
  const [sosSecondsRemaining, setSosSecondsRemaining] = useState(0);
  const [helplines, setHelplines] = useState([]);
  const chatSocketRef = useRef(null);

  function mergeMessage(message) {
    setMessages((current) => {
      if (current.some((item) =>
        (message.messageId && item.messageId === message.messageId) ||
        (message.sequence && item.sequence === message.sequence))) return current;
      return [...current, message].sort((a, b) =>
        (a.sequence || 0) - (b.sequence || 0));
    });
  }

  const clearAccess = useCallback((message = '') => {
    chatSocketRef.current?.close();
    chatSocketRef.current = null;
    setReporterToken(null);
    setCaseId('');
    setComplaint(null);
    setTriage(null);
    setTimeline([]);
    setEvidenceList([]);
    setMessages([]);
    setSos(null);
    setShowSosConfirmation(false);
    setSosNoticeAccepted(false);
    setShareOneTimeLocation(false);
    setChatInput('');
    setEvidenceFile(null);
    setSuccessMsg('');
    setCredentials(initialCredentials);
    if (message) {
      setErrorState({ type: 'expired', message });
    } else {
      setErrorState(null);
    }
  }, []);

  const inactivity = useReporterInactivityLock({
    active: Boolean(reporterToken && complaint),
    onLock: clearAccess
  });

  async function loadCase(activeCaseId, token) {
    setIsLoading(true);
    setErrorState(null);
    try {
      const [complaintRes, timelineRes, evidenceRes, chatRes, triageRes, sosRes, helpRes] = await Promise.all([
        getPublicComplaintRequest(activeCaseId, token),
        getComplaintTimelineRequest(activeCaseId, token),
        getComplaintEvidenceRequest(activeCaseId, token),
        getChatMessagesRequest(token, activeCaseId),
        getComplaintTriageRequest(activeCaseId, token),
        getCurrentSosRequest(token, activeCaseId),
        getVerifiedHelplinesRequest({ country: 'in' })
      ]);
      startTransition(() => {
        setComplaint(complaintRes.data.complaint);
        setTimeline(timelineRes.data.history);
        setEvidenceList(evidenceRes.data.evidenceList);
        setMessages(chatRes.data.messages);
        setTriage(triageRes.data.triage);
        setSos(sosRes.data.sos);
        setHelplines(helpRes.data.entries);
      });
    } catch (error) {
      if (error.code === 'REPORTER_ACCESS_EXPIRED') {
        clearAccess('Your case access session expired. Enter both credentials to unlock it again.');
      } else {
        setErrorState({ type: 'load', message: error.message });
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUnlock(event) {
    event.preventDefault();
    setIsUnlocking(true);
    setErrorState(null);
    try {
      const response = await exchangeReporterAccessRequest(
        credentials.caseId.trim(),
        credentials.accessSecret.trim()
      );
      const token = response.data.accessToken;
      const unlockedCaseId = credentials.caseId.trim();
      setReporterToken(token);
      setCaseId(unlockedCaseId);
      setCredentials(initialCredentials);
      await loadCase(unlockedCaseId, token);
    } catch (error) {
      setReporterToken(null);
      setErrorState({
        type: 'invalid',
        message:
          error.code === 'REPORTER_ACCESS_RATE_LIMITED'
            ? error.message
            : 'Case access could not be verified. Check both credentials and try again.'
      });
    } finally {
      setIsUnlocking(false);
    }
  }

  useEffect(() => {
    if (!reporterToken || !caseId) {
      return undefined;
    }

    const socket = createCaseChatSocket({
      credentialType: 'reporter', token: reporterToken, caseId,
      afterSequence: messages.at(-1)?.sequence || 0,
      onMessage: mergeMessage,
      onSos: (event) => setSos((current) =>
        current?.sosId === event.sosId ? { ...current, ...event } : current),
      onState: setChatConnectionState,
      onRevoked: () => clearAccess(
        'Your case access is no longer available. Enter both credentials to unlock again.'
      )
    });
    chatSocketRef.current = socket;

    return () => {
      socket.close();
      if (chatSocketRef.current === socket) chatSocketRef.current = null;
    };
  }, [reporterToken, caseId]);

  useEffect(() => {
    if (sos?.state !== 'confirmation_pending' || !sos.cancelUntil) {
      setSosSecondsRemaining(0);
      return undefined;
    }
    const update = () => setSosSecondsRemaining(Math.max(
      0, Math.ceil((new Date(sos.cancelUntil).getTime() - Date.now()) / 1000)
    ));
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [sos?.state, sos?.cancelUntil]);

  async function handleStartSos() {
    setErrorState(null);
    try {
      const response = await startSosConfirmationRequest(
        reporterToken, caseId, crypto.randomUUID()
      );
      setSos(response.data.sos);
      setShowSosConfirmation(false);
      setSosNoticeAccepted(false);
    } catch (error) {
      setErrorState({ type: 'sos', message: error.message });
    }
  }

  async function handleCancelSos() {
    try {
      const response = await cancelSosRequest(reporterToken, caseId, sos.sosId);
      setSos(response.data.sos);
      setShareOneTimeLocation(false);
    } catch (error) {
      setErrorState({ type: 'sos', message: error.message });
    }
  }

  async function oneTimeLocation() {
    if (!shareOneTimeLocation || !navigator.geolocation) return null;
    return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 0, timeout: 5000 }
    ));
  }

  async function handleActivateSos() {
    setErrorState(null);
    const location = await oneTimeLocation();
    try {
      const response = await activateSosRequest(
        reporterToken, caseId, sos.sosId, {
          version: sos.version,
          locationConsent: Boolean(location),
          locationMode: location ? 'current_once' : 'none',
          location
        }
      );
      setSos(response.data.sos);
      if (shareOneTimeLocation && !location) {
        setSuccessMsg('The safety request was created without location because location permission was unavailable.');
      }
    } catch (error) {
      setErrorState({ type: 'sos', message: error.message });
    }
  }

  async function handleEvidenceUpload(event) {
    event.preventDefault();
    if (!evidenceFile) return;
    setIsUploading(true);
    setErrorState(null);
    setSuccessMsg('');
    const formData = new FormData();
    formData.append('media', evidenceFile);
    try {
      await uploadComplaintEvidenceRequest(caseId, formData, reporterToken);
      const [evidenceRes, timelineRes] = await Promise.all([
        getComplaintEvidenceRequest(caseId, reporterToken),
        getComplaintTimelineRequest(caseId, reporterToken)
      ]);
      setEvidenceList(evidenceRes.data.evidenceList);
      setTimeline(timelineRes.data.history);
      setEvidenceFile(null);
      setSuccessMsg('Evidence was received by the private vault. Its current review status is shown below.');
      event.target.reset();
    } catch (error) {
      if (error.code === 'REPORTER_ACCESS_EXPIRED') {
        clearAccess('Your case access session expired. Enter both credentials to unlock it again.');
      } else {
        setErrorState({ type: 'upload', message: error.message });
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function handleEvidenceDownload(file) {
    if (!file.evidenceId || file.lifecycleStatus !== 'available') return;
    setDownloadingEvidenceId(file.evidenceId);
    setErrorState(null);
    try {
      const { blob } = await downloadComplaintEvidenceRequest(caseId, file.evidenceId, reporterToken);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = file.originalName || `evidence${file.detectedExtension || ''}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      if (error.status === 401) {
        clearAccess('Your case access session expired. Enter both credentials to unlock it again.');
      } else {
        const safeMessages = {
          403: 'You are not authorized to download this evidence.',
          404: 'This evidence is unavailable.',
          409: 'This evidence is not currently available or failed integrity verification.',
          422: 'The evidence request could not be processed.'
        };
        setErrorState({ type: 'download', message: safeMessages[error.status] || error.message });
      }
    } finally {
      setDownloadingEvidenceId(null);
    }
  }

  async function handleSendChat(event) {
    event.preventDefault();
    if (!chatInput.trim()) return;
    setIsSendingChat(true);
    try {
      const clientMessageId = crypto.randomUUID();
      const result = chatSocketRef.current?.connected
        ? await sendRealtimeMessage(chatSocketRef.current, {
          caseId, text: chatInput.trim(), clientMessageId
        })
        : await sendChatMessageRequest(reporterToken, caseId, chatInput.trim(), {
          clientMessageId
        }).then((response) => ({ message: response.data.message }));
      mergeMessage(result.message);
      setChatInput('');
    } catch (error) {
      if (error.code === 'REPORTER_ACCESS_EXPIRED') {
        clearAccess('Your case access session expired. Enter both credentials to unlock it again.');
      } else {
        setErrorState({ type: 'chat', message: error.message });
      }
    } finally {
      setIsSendingChat(false);
    }
  }

  if (!reporterToken || !complaint) {
    return (
      <div className="page-shell py-12">
        <section className="surface-panel mx-auto max-w-xl p-7 sm:p-9">
          <p className="eyebrow">Private case access</p>
          <h1 className="mt-3 text-3xl font-semibold text-brand-950">Unlock your case</h1>
          <p className="mt-3 text-sm leading-6 text-brand-600">
            Enter the case ID and reporter access secret from your recovery card. Neither value is
            saved in browser storage or added to the URL.
          </p>
          {errorState ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
              {errorState.message}
            </div>
          ) : null}
          <form onSubmit={handleUnlock} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-brand-900">Case ID</span>
              <input
                required
                autoComplete="off"
                value={credentials.caseId}
                onChange={(event) => setCredentials((current) => ({ ...current, caseId: event.target.value }))}
                className="field-input"
                placeholder="anon-..."
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-brand-900">Reporter access secret</span>
              <input
                required
                type="password"
                autoComplete="off"
                value={credentials.accessSecret}
                onChange={(event) => setCredentials((current) => ({ ...current, accessSecret: event.target.value }))}
                className="field-input"
              />
            </label>
            <button type="submit" disabled={isUnlocking} className="button-primary w-full">
              {isUnlocking || isLoading ? 'Verifying access...' : 'Unlock case'}
            </button>
          </form>
          <p className="mt-4 text-xs leading-5 text-brand-500">
            There is no automatic “forgot secret” flow. Legacy cases created before reporter
            credentials were introduced are locked from anonymous access.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      {inactivity.secondsRemaining != null ? (
        <AccessibleDialog title={t('lock.title')} onClose={inactivity.continueSession}>
          <p className="mt-3" aria-live="assertive">
            {t('lock.warning', { seconds: inactivity.secondsRemaining })}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="button-primary" autoFocus
              onClick={inactivity.continueSession}>{t('lock.continue')}</button>
            <button type="button" className="button-secondary"
              onClick={inactivity.lockNow}>{t('lock.now')}</button>
          </div>
        </AccessibleDialog>
      ) : null}
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link to="/" onClick={() => clearAccess()} className="text-sm font-semibold text-brand-700 hover:underline">
          &larr; Exit case
        </Link>
        <button type="button" onClick={() => clearAccess()} className="button-secondary">
          Lock case
        </button>
      </div>
      {errorState ? <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{errorState.message}</div> : null}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="surface-panel p-6 sm:p-8">
            <p className="eyebrow">Case reference: {complaint.caseId}</p>
            <h1 className="mt-3 text-3xl font-semibold text-brand-950">Case status</h1>
            <p className="mt-4 text-lg font-semibold capitalize text-teal-700">{complaint.status.replace('-', ' ')}</p>
            {triage ? <div className={`mt-4 rounded-2xl border p-4 ${
              triage.severity === 'critical' ? 'border-rose-300 bg-rose-50' : 'border-brand-100 bg-brand-50'
            }`}>
              <p className="font-semibold capitalize text-brand-950">Initial severity: {triage.severity}</p>
              <p className="mt-1 text-sm text-brand-700">{triage.meaning}</p>
              {triage.humanReviewPending ? <p className="mt-2 text-sm font-semibold">Human review is pending.</p> : null}
              {triage.severity === 'critical' ? <p className="mt-3 text-sm font-semibold text-rose-800">
                {triage.safetyGuidance || CRITICAL_SAFETY_GUIDANCE}
              </p> : null}
              <p className="mt-2 text-xs text-brand-600">{triage.initialAssessmentNotice}</p>
              <p className="mt-2 text-sm font-semibold text-brand-800">
                Workflow status: {triage.workflowStatus || 'Awaiting review'}
              </p>
              <p className="mt-1 text-xs text-brand-600">{triage.workflowNotice}</p>
              <p className="mt-1 text-xs text-brand-600">SatyaShield is not an emergency or dispatch service.</p>
            </div> : null}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-brand-700">{complaint.description}</p>
            <p className="text-sm text-brand-600 mb-2">
              Support routing: {String(complaint.supportRoutingStatus || 'pending_admin_review').replaceAll('_', ' ')}
            </p>
            {complaint.assignedNgo ? (
              <p className="mt-4 text-sm text-brand-600">
                Assigned support organization: <strong>{complaint.assignedNgo.name}</strong>
                {complaint.assignedNgo.coverageLabel ? ` (${complaint.assignedNgo.coverageLabel})` : ''}
              </p>
            ) : null}
          </section>
          <section className="surface-panel border-rose-200 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-rose-950">SOS safety request</h2>
            <p className="mt-2 text-sm leading-6 text-rose-800">
              SatyaShield may not contact police, ambulance services, emergency responders or an
              NGO automatically. If immediate danger exists, move to safety where possible and
              deliberately contact an appropriate local emergency service or trusted person.
            </p>
            {!sos || ['cancelled', 'resolved', 'expired', 'closed', 'false_alarm_marked'].includes(sos.state) ? (
              !showSosConfirmation ? (
                <button type="button" className="button-primary mt-4"
                  onClick={() => setShowSosConfirmation(true)}>
                  Start SOS safety request
                </button>
              ) : (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <label className="flex items-start gap-3 text-sm text-rose-950">
                    <input type="checkbox" checked={sosNoticeAccepted}
                      onChange={(event) => setSosNoticeAccepted(event.target.checked)} />
                    <span>I understand this is an internal safety request, not guaranteed emergency dispatch.</span>
                  </label>
                  <div className="mt-4 flex gap-3">
                    <button type="button" className="button-primary"
                      disabled={!sosNoticeAccepted} onClick={handleStartSos}>
                      Begin cancel countdown
                    </button>
                    <button type="button" className="button-secondary"
                      onClick={() => setShowSosConfirmation(false)}>Back</button>
                  </div>
                </div>
              )
            ) : null}
            {sos?.state === 'confirmation_pending' ? (
              <div className="mt-4 rounded-2xl border border-rose-200 p-4" aria-live="polite">
                <p className="font-semibold text-rose-950">
                  Cancellation countdown: {sosSecondsRemaining} seconds
                </p>
                <label className="mt-3 flex items-start gap-3 text-sm text-brand-700">
                  <input type="checkbox" checked={shareOneTimeLocation}
                    onChange={(event) => setShareOneTimeLocation(event.target.checked)} />
                  <span>Optionally share an approximate one-time device location. This is off by default.</span>
                </label>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" className="button-secondary" onClick={handleCancelSos}>
                    Cancel request
                  </button>
                  <button type="button" className="button-primary"
                    disabled={sosSecondsRemaining > 0} onClick={handleActivateSos}>
                    Create internal safety request
                  </button>
                </div>
              </div>
            ) : null}
            {sos && !['confirmation_pending', 'cancelled'].includes(sos.state) ? (
              <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 p-4">
                <p className="font-semibold capitalize text-brand-950">
                  Status: {sos.state.replaceAll('_', ' ')}
                </p>
                <p className="mt-2 text-sm text-brand-700">{sos.statusNotice}</p>
                <p className="mt-2 text-xs text-brand-600">
                  “Sent” does not mean received, and acknowledgment does not guarantee action.
                </p>
              </div>
            ) : null}
          </section>
          <section className="surface-panel p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-brand-950">Verified helplines</h2>
            {helplines.length ? (
              <div className="mt-4 space-y-3">
                {helplines.map((entry) => (
                  <article key={entry.helplineId} className="rounded-2xl border border-brand-100 p-4">
                    <p className="font-semibold text-brand-950">{entry.displayName}</p>
                    <p className="mt-1 text-sm text-brand-700">{entry.availabilityWording}</p>
                    <a className="button-secondary mt-3 inline-flex"
                      href={entry.contactMethod === 'website'
                        ? entry.contactValue : `tel:${entry.contactValue}`}>
                      Contact deliberately
                    </a>
                    <p className="mt-2 text-xs text-brand-500">{entry.safeDisclaimer}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-brand-600">
                No currently verified directory entry is available for this region. SatyaShield
                will not invent or display an expired number.
              </p>
            )}
          </section>
          <section className="surface-panel p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-brand-950">Case timeline</h2>
            <div className="mt-5 space-y-4">
              {timeline.length ? timeline.map((item, index) => (
                <article key={`${item.createdAt}-${item.action}-${index}`} className="rounded-2xl border border-brand-100 p-4">
                  <p className="text-xs text-brand-500">{new Date(item.createdAt).toLocaleString()}</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-brand-950">{item.action.replaceAll('_', ' ')}</p>
                  <p className="mt-1 text-sm text-brand-700">{item.description}</p>
                </article>
              )) : <p className="text-sm text-brand-600">No reporter-visible updates yet.</p>}
            </div>
          </section>
          <section className="surface-panel p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-brand-950">Evidence received</h2>
            <p className="mt-2 text-xs text-brand-600">
              Files are held in the private evidence vault. Download is available only while your case session is unlocked and the file is available.
            </p>
            {successMsg ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successMsg}</div> : null}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {evidenceList.map((file, index) => (
                <article key={`${file.createdAt}-${file.originalName}-${index}`} className="rounded-2xl border border-brand-100 p-4">
                  <p className="text-xs font-semibold uppercase text-brand-500">{file.category}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-brand-900">{file.originalName}</p>
                  <p className="mt-1 text-xs text-brand-500">{Math.round(file.fileSize / 1024)} KB</p>
                  <p className="mt-1 text-xs font-semibold capitalize text-brand-600">
                    {file.lifecycleStatus.replaceAll('_', ' ')}
                    {file.scanStatus === 'not_configured' ? ' · malware scanning not configured' : ''}
                  </p>
                  {file.lifecycleStatus === 'available' && file.downloadPath ? (
                    <button
                      type="button"
                      onClick={() => handleEvidenceDownload(file)}
                      disabled={downloadingEvidenceId === file.evidenceId}
                      className="button-secondary mt-3 px-3 py-1.5 text-xs"
                    >
                      {downloadingEvidenceId === file.evidenceId ? 'Downloading...' : 'Authorized download'}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
            <form onSubmit={handleEvidenceUpload} className="mt-6 flex flex-col gap-3 border-t border-brand-100 pt-6 sm:flex-row">
              <input required type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)} className="block w-full text-xs text-brand-700" />
              <button type="submit" disabled={isUploading || !evidenceFile} className="button-primary shrink-0">
                {isUploading ? 'Validating and encrypting...' : 'Upload evidence'}
              </button>
            </form>
          </section>
        </div>
        <section className="surface-panel flex h-[560px] flex-col p-6">
          <h2 className="text-xl font-semibold text-brand-950">Case chat</h2>
          <p className="mt-1 text-xs text-brand-600" aria-live="polite">
            Real-time connection: {chatConnectionState.replaceAll('_', ' ')}.
            Messages are server-persisted; delivery is not guaranteed.
          </p>
          <p className="mt-1 text-xs text-brand-500">Encrypted in transit and at rest; this is not end-to-end encryption.</p>
          <div className="my-4 flex-1 space-y-3 overflow-y-auto">
            {messages.map((message, index) => (
              <article key={`${message.createdAt}-${index}`} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.senderRole === 'victim' ? 'ml-auto bg-brand-950 text-white' : 'bg-brand-50 text-brand-950'}`}>
                <p className="mb-1 text-[10px] uppercase opacity-70">{message.senderLabel}</p>
                <p>{message.text}</p>
              </article>
            ))}
          </div>
          <form onSubmit={handleSendChat} className="flex gap-2">
            <input required value={chatInput} onChange={(event) => setChatInput(event.target.value)} className="field-input" placeholder="Type a case message..." />
            <button type="submit" disabled={isSendingChat || !chatInput.trim()} className="button-primary">Send</button>
          </form>
        </section>
      </div>
    </div>
  );
}
