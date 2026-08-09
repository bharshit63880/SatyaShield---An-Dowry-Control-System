import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { exchangeReporterAccessRequest, downloadComplaintEvidenceRequest, getChatMessagesRequest, getComplaintEvidenceRequest, getComplaintTimelineRequest, getComplaintTriageRequest, getPublicComplaintRequest, sendChatMessageRequest, startSosConfirmationRequest, cancelSosRequest, activateSosRequest, getCurrentSosRequest, getVerifiedHelplinesRequest, getPlatformConfigRequest, uploadComplaintEvidenceRequest } from '../services/api';
import { createCaseChatSocket, sendRealtimeMessage } from '../services/realtime-chat';
import { useLanguage } from '../context/LanguageContext';
import { useReporterInactivityLock } from '../hooks/useReporterInactivityLock';
import { AccessibleDialog } from '../components/ui/AccessibleDialog';
const initialCredentials = {
  caseId: '',
  accessSecret: ''
};
export function CaseTrackingPage() {
  const {
    t
  } = useLanguage();
  const location = useLocation();
  const {
    anonymousId = ''
  } = useParams();
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
  const [sosFeatures, setSosFeatures] = useState({ internalSupport: false, location: false });
  const chatSocketRef = useRef(null);
  function mergeMessage(message) {
    setMessages(current => {
      if (current.some(item => message.messageId && item.messageId === message.messageId || message.sequence && item.sequence === message.sequence)) return current;
      return [...current, message].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
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
      setErrorState({
        type: 'expired',
        message
      });
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
      const [complaintRes, timelineRes, evidenceRes, chatRes, triageRes, sosRes, helpRes, platformRes] = await Promise.all([getPublicComplaintRequest(activeCaseId, token), getComplaintTimelineRequest(activeCaseId, token), getComplaintEvidenceRequest(activeCaseId, token), getChatMessagesRequest(token, activeCaseId), getComplaintTriageRequest(activeCaseId, token), getCurrentSosRequest(token, activeCaseId), getVerifiedHelplinesRequest({
        country: 'in'
      }), getPlatformConfigRequest()]);
      startTransition(() => {
        setComplaint(complaintRes.data.complaint);
        setTimeline(timelineRes.data.history);
        setEvidenceList(evidenceRes.data.evidenceList);
        setMessages(chatRes.data.messages);
        setTriage(triageRes.data.triage);
        setSos(sosRes.data.sos);
        setHelplines(helpRes.data.entries);
        setSosFeatures({
          internalSupport: platformRes.data.features.sosInternalSupport === true,
          location: platformRes.data.features.sosLocation === true
        });
      });
    } catch (error) {
      if (error.code === 'REPORTER_ACCESS_EXPIRED') {
        clearAccess(t('runtime.caseExpired'));
      } else {
        setErrorState({
          type: 'load',
          message: t('runtime.genericRequestFailed')
        });
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
      const response = await exchangeReporterAccessRequest(credentials.caseId.trim(), credentials.accessSecret.trim());
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
        message: t('runtime.caseVerifyFailed')
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
      credentialType: 'reporter',
      token: reporterToken,
      caseId,
      afterSequence: messages.at(-1)?.sequence || 0,
      onMessage: mergeMessage,
      onSos: event => setSos(current => current?.sosId === event.sosId ? {
        ...current,
        ...event
      } : current),
      onState: setChatConnectionState,
      onRevoked: () => clearAccess(t('runtime.caseRevoked'))
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
    const update = () => setSosSecondsRemaining(Math.max(0, Math.ceil((new Date(sos.cancelUntil).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [sos?.state, sos?.cancelUntil]);
  async function handleStartSos() {
    setErrorState(null);
    try {
      const response = await startSosConfirmationRequest(reporterToken, caseId, crypto.randomUUID());
      setSos(response.data.sos);
      setShowSosConfirmation(false);
      setSosNoticeAccepted(false);
    } catch (error) {
      setErrorState({
        type: 'sos',
        message: t('runtime.genericRequestFailed')
      });
    }
  }
  async function handleCancelSos() {
    try {
      const response = await cancelSosRequest(reporterToken, caseId, sos.sosId);
      setSos(response.data.sos);
      setShareOneTimeLocation(false);
    } catch (error) {
      setErrorState({
        type: 'sos',
        message: t('runtime.genericRequestFailed')
      });
    }
  }
  async function oneTimeLocation() {
    if (!shareOneTimeLocation || !navigator.geolocation) return null;
    return new Promise(resolve => navigator.geolocation.getCurrentPosition(({
      coords
    }) => resolve({
      latitude: coords.latitude,
      longitude: coords.longitude
    }), () => resolve(null), {
      enableHighAccuracy: false,
      maximumAge: 0,
      timeout: 5000
    }));
  }
  async function handleActivateSos() {
    setErrorState(null);
    const location = await oneTimeLocation();
    try {
      const response = await activateSosRequest(reporterToken, caseId, sos.sosId, {
        version: sos.version,
        locationConsent: Boolean(location),
        locationMode: location ? 'current_once' : 'none',
        location
      });
      setSos(response.data.sos);
      if (shareOneTimeLocation && !location) {
        setSuccessMsg(t('runtime.sosWithoutLocation'));
      }
    } catch (error) {
      setErrorState({
        type: 'sos',
        message: t('runtime.genericRequestFailed')
      });
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
      const [evidenceRes, timelineRes] = await Promise.all([getComplaintEvidenceRequest(caseId, reporterToken), getComplaintTimelineRequest(caseId, reporterToken)]);
      setEvidenceList(evidenceRes.data.evidenceList);
      setTimeline(timelineRes.data.history);
      setEvidenceFile(null);
      setSuccessMsg(t('runtime.evidenceReceived'));
      event.target.reset();
    } catch (error) {
      if (error.code === 'REPORTER_ACCESS_EXPIRED') {
        clearAccess(t('runtime.caseExpired'));
      } else {
        setErrorState({
          type: 'upload',
          message: t('runtime.genericRequestFailed')
        });
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
      const {
        blob
      } = await downloadComplaintEvidenceRequest(caseId, file.evidenceId, reporterToken);
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
        clearAccess(t('runtime.caseExpired'));
      } else {
        const safeMessages = {
          403: 'You are not authorized to download this evidence.',
          404: 'This evidence is unavailable.',
          409: 'This evidence is not currently available or failed integrity verification.',
          422: 'The evidence request could not be processed.'
        };
        setErrorState({
          type: 'download',
          message: safeMessages[error.status] || t('runtime.evidenceUnavailable')
        });
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
      const result = chatSocketRef.current?.connected ? await sendRealtimeMessage(chatSocketRef.current, {
        caseId,
        text: chatInput.trim(),
        clientMessageId
      }) : await sendChatMessageRequest(reporterToken, caseId, chatInput.trim(), {
        clientMessageId
      }).then(response => ({
        message: response.data.message
      }));
      mergeMessage(result.message);
      setChatInput('');
    } catch (error) {
      if (error.code === 'REPORTER_ACCESS_EXPIRED') {
        clearAccess(t('runtime.caseExpired'));
      } else {
        setErrorState({
          type: 'chat',
          message: t('runtime.genericRequestFailed')
        });
      }
    } finally {
      setIsSendingChat(false);
    }
  }
  if (!reporterToken || !complaint) {
    return <div className="page-shell py-12">
        <section className="surface-panel mx-auto max-w-xl p-7 sm:p-9">
          <p className="eyebrow">{t("visible.cc6558a258e1")}</p>
          <h1 className="mt-3 text-3xl font-semibold text-brand-950">{t("visible.26ab4d5a57b8")}</h1>
          <p className="mt-3 text-sm leading-6 text-brand-600">{t("visible.858096f27e1a")}</p>
          {errorState ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
              {errorState.message}
            </div> : null}
          <form onSubmit={handleUnlock} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-brand-900">{t("visible.e0aed7cf64e8")}</span>
              <input required autoComplete="off" value={credentials.caseId} onChange={event => setCredentials(current => ({
              ...current,
              caseId: event.target.value
            }))} className="field-input" placeholder={t("visible.af297459b337")} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-brand-900">{t("visible.63e2bcd58dbe")}</span>
              <input required type="password" autoComplete="off" value={credentials.accessSecret} onChange={event => setCredentials(current => ({
              ...current,
              accessSecret: event.target.value
            }))} className="field-input" />
            </label>
            <button type="submit" disabled={isUnlocking} className="button-primary w-full">
              {isUnlocking || isLoading ? t('runtime.verifyingAccess') : t('runtime.unlockCase')}
            </button>
          </form>
          <p className="mt-4 text-xs leading-5 text-brand-500">{t("visible.e859150024a7")}</p>
        </section>
      </div>;
  }
  return <div className="page-shell py-8 sm:py-10">
      {inactivity.secondsRemaining != null ? <AccessibleDialog title={t('lock.title')} onClose={inactivity.continueSession}>
          <p className="mt-3" aria-live="assertive">
            {t('lock.warning', {
          seconds: inactivity.secondsRemaining
        })}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="button-primary" autoFocus onClick={inactivity.continueSession}>{t('lock.continue')}</button>
            <button type="button" className="button-secondary" onClick={inactivity.lockNow}>{t('lock.now')}</button>
          </div>
        </AccessibleDialog> : null}
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link to="/" onClick={() => clearAccess()} className="text-sm font-semibold text-brand-700 hover:underline">{t("visible.7f9f92bde51e")}</Link>
        <button type="button" onClick={inactivity.lockNow} className="button-secondary">{t("visible.58ae17675c28")}</button>
      </div>
      {errorState ? <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{errorState.message}</div> : null}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="surface-panel p-6 sm:p-8">
            <p className="eyebrow">{t("visible.8c803292ae8f")}{complaint.caseId}</p>
            <h1 className="mt-3 text-3xl font-semibold text-brand-950">{t("visible.1ee95710aa59")}</h1>
            <p className="mt-4 text-lg font-semibold capitalize text-teal-700">{complaint.status.replace('-', ' ')}</p>
            {triage ? <div className={`mt-4 rounded-2xl border p-4 ${triage.severity === 'critical' ? 'border-rose-300 bg-rose-50' : 'border-brand-100 bg-brand-50'}`}>
              <p className="font-semibold capitalize text-brand-950">{t("visible.9490b20209bd")}{triage.severity}</p>
              <p className="mt-1 text-sm text-brand-700">{triage.meaning}</p>
              {triage.humanReviewPending ? <p className="mt-2 text-sm font-semibold">{t("visible.8f9e09e7bec4")}</p> : null}
              {triage.severity === 'critical' ? <p className="mt-3 text-sm font-semibold text-rose-800">
                {t('runtime.criticalGuidance')}
              </p> : null}
              <p className="mt-2 text-xs text-brand-600">{triage.initialAssessmentNotice}</p>
              <p className="mt-2 text-sm font-semibold text-brand-800">{t("visible.3ba275e06106")}{triage.workflowStatus || 'Awaiting review'}
              </p>
              <p className="mt-1 text-xs text-brand-600">{triage.workflowNotice}</p>
              <p className="mt-1 text-xs text-brand-600">{t("visible.b5bfd5511da5")}</p>
            </div> : null}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-brand-700">{complaint.description}</p>
            <p className="text-sm text-brand-600 mb-2">{t("visible.6e925ca74d9d")}{String(complaint.supportRoutingStatus || 'pending_admin_review').replaceAll('_', ' ')}
            </p>
            {complaint.assignedNgo ? <p className="mt-4 text-sm text-brand-600">{t("visible.465e4c275f6c")}<strong>{complaint.assignedNgo.name}</strong>
                {complaint.assignedNgo.coverageLabel ? ` (${complaint.assignedNgo.coverageLabel})` : ''}
              </p> : null}
          </section>
          <section className="surface-panel border-rose-200 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-rose-950">{t('sos.title')}</h2>
            <p className="mt-2 text-sm leading-6 text-rose-800">{t('sos.warning')}</p>
            {!sosFeatures.internalSupport ? <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900" role="status">{t('sos.unavailable')}</p> : null}
            {sosFeatures.internalSupport && (!sos || ['cancelled', 'resolved', 'expired', 'closed', 'false_alarm_marked'].includes(sos.state)) ? !showSosConfirmation ? <button type="button" className="button-primary mt-4" onClick={() => setShowSosConfirmation(true)}>{t('sos.request')}</button> : <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <label className="flex items-start gap-3 text-sm text-rose-950">
                    <input type="checkbox" checked={sosNoticeAccepted} onChange={event => setSosNoticeAccepted(event.target.checked)} />
                    <span>{t("visible.b565d4db7b5c")}</span>
                  </label>
                  <div className="mt-4 flex gap-3">
                    <button type="button" className="button-primary" disabled={!sosNoticeAccepted} onClick={handleStartSos}>{t("visible.3b0238c3dd6c")}</button>
                    <button type="button" className="button-secondary" onClick={() => setShowSosConfirmation(false)}>{t("visible.76900f1bfd16")}</button>
                  </div>
                </div> : null}
            {sos?.state === 'confirmation_pending' ? <div className="mt-4 rounded-2xl border border-rose-200 p-4" aria-live="polite">
                <p className="font-semibold text-rose-950">{t("visible.688608c9ec97")}{sosSecondsRemaining}{t("visible.59f006d63bd0")}</p>
                {sosFeatures.location ? <label className="mt-3 flex items-start gap-3 text-sm text-brand-700">
                    <input type="checkbox" checked={shareOneTimeLocation} onChange={event => setShareOneTimeLocation(event.target.checked)} />
                    <span>{t('sos.location')}</span>
                  </label> : <p className="mt-3 text-sm text-brand-700">{t('sos.locationUnavailable')}</p>}
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" className="button-secondary" onClick={handleCancelSos}>{t("visible.56196683592d")}</button>
                  <button type="button" className="button-primary" disabled={sosSecondsRemaining > 0} onClick={handleActivateSos}>{t("visible.9f96d3783f93")}</button>
                </div>
              </div> : null}
            {sos && !['confirmation_pending', 'cancelled'].includes(sos.state) ? <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 p-4">
                <p className="font-semibold capitalize text-brand-950">{t("visible.755c8b2a9fb1")}{sos.state.replaceAll('_', ' ')}
                </p>
                <p className="mt-2 text-sm text-brand-700">{sos.statusNotice}</p>
                <p className="mt-2 text-xs text-brand-600">{t("visible.1f61ab40eab1")}</p>
              </div> : null}
          </section>
          <section className="surface-panel p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-brand-950">{t("visible.49d3fb90e797")}</h2>
            {helplines.length ? <div className="mt-4 space-y-3">
                {helplines.map(entry => <article key={entry.helplineId} className="rounded-2xl border border-brand-100 p-4">
                    <p className="font-semibold text-brand-950">{entry.displayName}</p>
                    <p className="mt-1 text-sm text-brand-700">{entry.availabilityWording}</p>
                    <a className="button-secondary mt-3 inline-flex" href={entry.contactMethod === 'website' ? entry.contactValue : `tel:${entry.contactValue}`}>{t("visible.ad7967fa3fad")}</a>
                    <p className="mt-2 text-xs text-brand-500">{entry.safeDisclaimer}</p>
                  </article>)}
              </div> : <p className="mt-3 text-sm text-brand-600">{t("visible.6c9acef1119e")}</p>}
          </section>
          <section className="surface-panel p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-brand-950">{t("visible.e7cfad562f21")}</h2>
            <div className="mt-5 space-y-4">
              {timeline.length ? timeline.map((item, index) => <article key={`${item.createdAt}-${item.action}-${index}`} className="rounded-2xl border border-brand-100 p-4">
                  <p className="text-xs text-brand-500">{new Date(item.createdAt).toLocaleString()}</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-brand-950">{item.action.replaceAll('_', ' ')}</p>
                  <p className="mt-1 text-sm text-brand-700">{item.description}</p>
                </article>) : <p className="text-sm text-brand-600">{t("visible.1956c5344918")}</p>}
            </div>
          </section>
          <section className="surface-panel p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-brand-950">{t("visible.b3d39f99c952")}</h2>
            <p className="mt-2 text-xs text-brand-600">{t("visible.11ab647d9dcd")}</p>
            {successMsg ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successMsg}</div> : null}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {evidenceList.map((file, index) => <article key={`${file.createdAt}-${file.originalName}-${index}`} className="rounded-2xl border border-brand-100 p-4">
                  <p className="text-xs font-semibold uppercase text-brand-500">{file.category}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-brand-900">{file.originalName}</p>
                  <p className="mt-1 text-xs text-brand-500">{Math.round(file.fileSize / 1024)} KB</p>
                  <p className="mt-1 text-xs font-semibold capitalize text-brand-600">
                    {file.lifecycleStatus.replaceAll('_', ' ')}
                    {file.scanStatus === 'not_configured' ? ` · ${t('runtime.scannerUnavailable')}` : ''}
                  </p>
                  {file.lifecycleStatus === 'available' && file.downloadPath ? <button type="button" onClick={() => handleEvidenceDownload(file)} disabled={downloadingEvidenceId === file.evidenceId} className="button-secondary mt-3 px-3 py-1.5 text-xs">
                      {downloadingEvidenceId === file.evidenceId ? t('runtime.downloading') : t('runtime.authorizedDownload')}
                    </button> : null}
                </article>)}
            </div>
            <form onSubmit={handleEvidenceUpload} className="mt-6 flex flex-col gap-3 border-t border-brand-100 pt-6 sm:flex-row">
              <input required type="file" accept=".jpg,.jpeg,.png,.webp" onChange={event => setEvidenceFile(event.target.files?.[0] || null)} className="block w-full text-xs text-brand-700" />
              <button type="submit" disabled={isUploading || !evidenceFile} className="button-primary shrink-0">
                {isUploading ? t('runtime.encryptingUpload') : t('runtime.uploadEvidence')}
              </button>
            </form>
          </section>
        </div>
        <section className="surface-panel flex h-[560px] flex-col p-6">
          <h2 className="text-xl font-semibold text-brand-950">{t("visible.3fd9cd3064f7")}</h2>
          <p className="mt-1 text-xs text-brand-600" aria-live="polite">{t("visible.0e430a1a078f")}{chatConnectionState.replaceAll('_', ' ')}{t("visible.f6d9c6da07ca")}</p>
          <p className="mt-1 text-xs text-brand-500">{t("visible.f5896a677782")}</p>
          <div className="my-4 flex-1 space-y-3 overflow-y-auto">
            {messages.map((message, index) => <article key={`${message.createdAt}-${index}`} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.senderRole === 'victim' ? 'ml-auto bg-brand-950 text-white' : 'bg-brand-50 text-brand-950'}`}>
                <p className="mb-1 text-[10px] uppercase opacity-70">{message.senderLabel}</p>
                <p>{message.text}</p>
              </article>)}
          </div>
          <form onSubmit={handleSendChat} className="flex gap-2">
            <input required value={chatInput} onChange={event => setChatInput(event.target.value)} className="field-input" placeholder={t("visible.d1abc1f67b2d")} />
            <button type="submit" disabled={isSendingChat || !chatInput.trim()} className="button-primary">{t("visible.f6f4688ff23d")}</button>
          </form>
        </section>
      </div>
    </div>;
}
