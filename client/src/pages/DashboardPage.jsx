import { useLanguage } from "../context/LanguageContext";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getDashboardComplaints, getDashboardSummary, updateDashboardComplaintStatusRequest, listNgosRequest, reviewNgoRequest, listInvestigatorsRequest, getAuditLogsRequest, getEscalationsRequest, resolveEscalationRequest, assignNgoRequest, assignInvestigatorRequest, escalateComplaintRequest, getChatMessagesRequest, sendChatMessageRequest, addInvestigationNoteRequest, getComplaintTimelineRequest, getComplaintEvidenceRequest, uploadComplaintEvidenceRequest, downloadComplaintEvidenceRequest, getNgoDashboardRequest, getInvestigatorDashboardRequest, acknowledgeNgoAssignmentRequest, getTriageHistoryRequest, reviewTriageRequest, getSosQueueRequest, updateSosRequest } from '../services/api';
import { createCaseChatSocket, sendRealtimeMessage } from '../services/realtime-chat';
export function DashboardPage() {
  const {
    t
  } = useLanguage();
  const {
    token,
    user,
    logout
  } = useAuth();

  // Base state
  const [summary, setSummary] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [triageHistory, setTriageHistory] = useState([]);
  const [triageSeverity, setTriageSeverity] = useState('high');
  const [triageReason, setTriageReason] = useState('new_information');
  const [triageNote, setTriageNote] = useState('');

  // Search & Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Tabs for Admin: 'triage', 'ngos', 'escalations', 'audit'
  const [adminTab, setAdminTab] = useState('triage');

  // Directory lists for assignments
  const [ngos, setNgos] = useState([]);
  const [investigators, setInvestigators] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [sosQueue, setSosQueue] = useState([]);

  // NGO & Investigator dashboard-specific states
  const [roleDashboardData, setRoleDashboardData] = useState(null);

  // Active Case Detail View Modal / Drawer State
  const [activeCase, setActiveCase] = useState(null);
  const [activeCaseTimeline, setActiveCaseTimeline] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [activeCaseEvidence, setActiveCaseEvidence] = useState([]);
  const [staffEvidenceFile, setStaffEvidenceFile] = useState(null);
  const [downloadingEvidenceId, setDownloadingEvidenceId] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [investigationNoteInput, setInvestigationNoteInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Modal actions (approvals / escalations)
  const [escalationReason, setEscalationReason] = useState('administrative_review');
  const [ngoReviewNote, setNgoReviewNote] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [chatConnectionState, setChatConnectionState] = useState('closed');
  const chatSocketRef = useRef(null);
  const deferredSearch = useDeferredValue(searchTerm);
  const isAdministrator = user.role === 'admin' || user.role === 'superadmin';
  function mergeChatMessage(message) {
    setChatMessages(current => {
      if (current.some(item => message.messageId && item.messageId === message.messageId || message.sequence && item.sequence === message.sequence)) return current;
      return [...current, message].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    });
  }
  useEffect(() => {
    if (!token || !activeCase?.anonymousId) return undefined;
    const socket = createCaseChatSocket({
      credentialType: 'staff',
      token,
      caseId: activeCase.anonymousId,
      afterSequence: chatMessages.at(-1)?.sequence || 0,
      onMessage: mergeChatMessage,
      onState: setChatConnectionState,
      onRevoked: () => {
        setChatConnectionState('access_revoked');
        setErrorMsg(t('runtime.staffAccessRevoked'));
      }
    });
    chatSocketRef.current = socket;
    return () => {
      socket.close();
      if (chatSocketRef.current === socket) chatSocketRef.current = null;
    };
  }, [token, activeCase?.anonymousId]);
  useEffect(() => {
    if (!isAdministrator || adminTab !== 'sos') return;
    getSosQueueRequest(token).then(response => setSosQueue(response.data.requests)).catch(error => setErrorMsg(authorizationMessage(error, 'runtime.sosQueueUnavailable')));
  }, [adminTab, isAdministrator, token]);
  async function handleSosAcknowledge(item) {
    try {
      const response = await updateSosRequest(token, item.caseId, item.sosId, {
        version: item.version,
        action: 'acknowledge'
      });
      setSosQueue(current => current.map(value => value.sosId === item.sosId ? response.data.sos : value));
    } catch (error) {
      setErrorMsg(authorizationMessage(error, 'runtime.sosAcknowledgeFailed'));
    }
  }
  function authorizationMessage(error, fallbackKey) {
    if (error?.status === 401) return t('runtime.sessionExpired');
    if (error?.status === 403) return t('runtime.forbidden');
    return t(fallbackKey);
  }

  // Load directories and data based on Role
  useEffect(() => {
    let isMounted = true;
    async function loadInitialData() {
      setIsLoading(true);
      setErrorMsg('');
      try {
        if (user.role === 'admin' || user.role === 'superadmin') {
          const [summaryRes, ngoRes, invRes, escRes, auditRes] = await Promise.all([getDashboardSummary(token), listNgosRequest(token), listInvestigatorsRequest(token), getEscalationsRequest(token), getAuditLogsRequest(token, 1, 50)]);
          if (isMounted) {
            setSummary(summaryRes.data);
            setNgos(ngoRes.data.ngos);
            setInvestigators(invRes.data.investigators);
            setEscalations(escRes.data.escalations);
            setAuditLogs(auditRes.data.logs);
          }
        } else if (user.role === 'ngo') {
          const dashboardRes = await getNgoDashboardRequest(token);
          if (isMounted) {
            setRoleDashboardData(dashboardRes.data);
          }
        } else if (user.role === 'investigator') {
          const dashboardRes = await getInvestigatorDashboardRequest(token);
          if (isMounted) {
            setRoleDashboardData(dashboardRes.data);
          }
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg(authorizationMessage(err, 'runtime.dashboardLoadFailed'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [token, user]);

  // Load Complaints Queue based on filters
  useEffect(() => {
    let isMounted = true;
    async function loadComplaintsQueue() {
      if (user.role !== 'admin' && user.role !== 'superadmin') return;
      try {
        const response = await getDashboardComplaints(token, {
          status: statusFilter,
          riskLevel: riskFilter,
          search: deferredSearch,
          page: currentPage,
          limit: 10
        });
        if (isMounted) {
          setComplaints(response.data.complaints);
          setPagination(response.data.pagination);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg(authorizationMessage(err, 'runtime.complaintsLoadFailed'));
        }
      }
    }
    loadComplaintsQueue();
    return () => {
      isMounted = false;
    };
  }, [token, user, statusFilter, riskFilter, deferredSearch, currentPage]);

  // Handle NGO Approval / Rejection
  async function handleNgoReview(id, status) {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const selected = ngos.find(ngo => ngo.ngoId === id);
      await reviewNgoRequest(token, id, status, ngoReviewNote, selected?.profileVersion);
      setSuccessMsg(`NGO successfully ${status}.`);
      setNgoReviewNote('');
      const ngoRes = await listNgosRequest(token);
      setNgos(ngoRes.data.ngos);
    } catch (err) {
      setErrorMsg(t('runtime.genericRequestFailed'));
    }
  }

  // Handle Case Escalation Resolution
  async function handleResolveEscalation(escalation) {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await resolveEscalationRequest(token, escalation.escalationId, escalation.version, resolutionNote);
      setSuccessMsg(t('runtime.workflowResolved'));
      setResolutionNote('');
      const escRes = await getEscalationsRequest(token);
      setEscalations(escRes.data.escalations);
    } catch (err) {
      setErrorMsg(t('runtime.genericRequestFailed'));
    }
  }

  // Handle NGO assignment override
  async function handleAssignNgo(anonymousId, ngoId) {
    setErrorMsg('');
    try {
      await assignNgoRequest(token, anonymousId, ngoId);
      setSuccessMsg(t('runtime.ngoAssigned'));
      // Refresh complaints queue
      const response = await getDashboardComplaints(token, {
        status: statusFilter,
        riskLevel: riskFilter,
        page: currentPage
      });
      setComplaints(response.data.complaints);
    } catch (err) {
      setErrorMsg(t('runtime.genericRequestFailed'));
    }
  }
  async function handleTriageReview(action) {
    if (!activeCase?.triage?.assessmentId) return;
    setErrorMsg('');
    try {
      await reviewTriageRequest(token, activeCase.anonymousId, {
        assessmentId: activeCase.triage.assessmentId,
        version: activeCase.triage.version,
        previousSeverity: activeCase.triage.severity,
        action,
        severity: action === 'override' ? triageSeverity : undefined,
        overrideCategory: action === 'override' ? triageReason : undefined,
        note: action === 'override' ? triageNote : undefined
      });
      const history = await getTriageHistoryRequest(token, activeCase.anonymousId);
      setTriageHistory(history.data.assessments);
      setSuccessMsg(t('runtime.triageSaved'));
      setTriageNote('');
    } catch (error) {
      setErrorMsg(error.status === 409 ? t('runtime.triageConflict') : t('runtime.triageSaveFailed'));
    }
  }

  // Handle Investigator assignment
  async function handleAssignInvestigator(anonymousId, investigatorId) {
    setErrorMsg('');
    try {
      await assignInvestigatorRequest(token, anonymousId, investigatorId);
      setSuccessMsg(t('runtime.investigatorAssigned'));
      const response = await getDashboardComplaints(token, {
        status: statusFilter,
        riskLevel: riskFilter,
        page: currentPage
      });
      setComplaints(response.data.complaints);
    } catch (err) {
      setErrorMsg(t('runtime.genericRequestFailed'));
    }
  }

  // Handle Escalating a complaint
  async function handleEscalateCase(e) {
    e.preventDefault();
    if (!isAdministrator || !activeCase || !escalationReason) return;
    setErrorMsg('');
    try {
      await escalateComplaintRequest(token, activeCase.anonymousId, escalationReason, crypto.randomUUID());
      setSuccessMsg(t('runtime.internalReviewAdded'));
      setEscalationReason('administrative_review');
      // Refresh timeline
      const timelineRes = await getComplaintTimelineRequest(activeCase.anonymousId, token);
      setActiveCaseTimeline(timelineRes.data.history);
    } catch (err) {
      setErrorMsg(t('runtime.genericRequestFailed'));
    }
  }

  // Select a Case for Detailed view / Chat / Notes
  async function handleSelectCase(c) {
    setErrorMsg('');
    setSuccessMsg('');
    setActiveCase(c);
    try {
      const [timelineRes, chatRes, evidenceRes] = await Promise.all([getComplaintTimelineRequest(c.anonymousId, token), getChatMessagesRequest(token, c.anonymousId), getComplaintEvidenceRequest(c.anonymousId, token)]);
      setActiveCaseTimeline(timelineRes.data.history);
      setChatMessages(chatRes.data.messages);
      setActiveCaseEvidence(evidenceRes.data.evidenceList);
    } catch (err) {
      setErrorMsg(authorizationMessage(err, 'runtime.caseActivityLoadFailed'));
    }
  }
  async function handleStaffEvidenceUpload(event) {
    event.preventDefault();
    if (!staffEvidenceFile || !activeCase) return;
    const formData = new FormData();
    formData.append('media', staffEvidenceFile);
    try {
      await uploadComplaintEvidenceRequest(activeCase.anonymousId, formData, token);
      const response = await getComplaintEvidenceRequest(activeCase.anonymousId, token);
      setActiveCaseEvidence(response.data.evidenceList);
      setStaffEvidenceFile(null);
      event.target.reset();
    } catch (error) {
      setErrorMsg(authorizationMessage(error, 'runtime.evidenceUploadFailed'));
    }
  }
  async function handleStaffEvidenceDownload(evidence) {
    setDownloadingEvidenceId(evidence.evidenceId);
    try {
      const {
        blob
      } = await downloadComplaintEvidenceRequest(activeCase.anonymousId, evidence.evidenceId, token);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = evidence.originalName || `evidence${evidence.detectedExtension || ''}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setErrorMsg(authorizationMessage(error, 'runtime.evidenceUnavailable'));
    } finally {
      setDownloadingEvidenceId(null);
    }
  }

  // Submit Chat message
  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatInput.trim() || !activeCase) return;
    setIsSendingChat(true);
    try {
      const clientMessageId = crypto.randomUUID();
      const result = chatSocketRef.current?.connected ? await sendRealtimeMessage(chatSocketRef.current, {
        caseId: activeCase.anonymousId,
        text: chatInput.trim(),
        clientMessageId
      }) : await sendChatMessageRequest(token, activeCase.anonymousId, chatInput.trim(), {
        clientMessageId
      }).then(response => ({
        message: response.data.message
      }));
      mergeChatMessage(result.message);
      setChatInput('');
    } catch (err) {
      setErrorMsg(t('runtime.genericRequestFailed'));
    } finally {
      setIsSendingChat(false);
    }
  }

  // Submit Investigation Note
  async function handleAddNote(e) {
    e.preventDefault();
    if (user.role !== 'investigator' || !investigationNoteInput.trim() || !activeCase) return;
    setIsAddingNote(true);
    try {
      await addInvestigationNoteRequest(token, activeCase.anonymousId, investigationNoteInput.trim());
      setInvestigationNoteInput('');
      const timelineRes = await getComplaintTimelineRequest(activeCase.anonymousId, token);
      setActiveCaseTimeline(timelineRes.data.history);
    } catch (err) {
      setErrorMsg(t('runtime.genericRequestFailed'));
    } finally {
      setIsAddingNote(false);
    }
  }

  // Update Case status
  async function handleStatusUpdate(status) {
    if (!isAdministrator || !activeCase) return;
    setErrorMsg('');
    try {
      const res = await updateDashboardComplaintStatusRequest(token, activeCase.anonymousId, status);
      setActiveCase(res.data.complaint);

      // Refresh complaints and timeline
      const [timelineRes, complRes] = await Promise.all([getComplaintTimelineRequest(activeCase.anonymousId, token), getDashboardComplaints(token, {
        status: statusFilter,
        riskLevel: riskFilter,
        page: currentPage
      })]);
      setActiveCaseTimeline(timelineRes.data.history);
      setComplaints(complRes.data.complaints);
    } catch (err) {
      setErrorMsg(t('runtime.genericRequestFailed'));
    }
  }
  async function handleAcknowledgeNgoAssignment() {
    if (user.role !== 'ngo' || !activeCase) return;
    setErrorMsg('');
    try {
      const response = await acknowledgeNgoAssignmentRequest(token, activeCase.anonymousId);
      setActiveCase(response.data.complaint);
      setSuccessMsg(t('runtime.assignmentAcknowledged'));
    } catch (err) {
      setErrorMsg(authorizationMessage(err, 'runtime.assignmentAcknowledgeFailed'));
    }
  }

  // Export Complaints to CSV
  function handleExportCSV() {
    if (complaints.length === 0) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'AnonymousID,Status,RiskLevel,Timestamp,Description,AssignedNGO,AssignedInvestigator\n';
    complaints.forEach(c => {
      const cleanDesc = c.description.replace(/"/g, '""');
      csvContent += `"${c.anonymousId}","${c.status}","${c.triage?.severity || 'review_required'}","${c.timestamp}","${cleanDesc}","${c.assignedNgo?.name || 'None'}","${c.assignedInvestigator?.name || 'None'}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'satyashield_complaints_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  if (isLoading) {
    return <div className="page-shell py-16" style={{
      textAlign: 'center'
    }}>
        <div style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
          <div style={{
          width: '56px',
          height: '56px',
          border: '3px solid rgba(0,229,204,0.15)',
          borderTopColor: '#00e5cc',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
          <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '14px'
        }}>{t("visible.7317a899b37a")}</p>
          <p style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          color: 'rgba(0,229,204,0.4)'
        }}>{t("visible.603b19eb6d6d")}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>;
  }
  return <div className="page-shell py-8 sm:py-10">
      {/* Header Panel */}
      <header style={{
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '16px',
      background: 'rgba(13,20,32,0.95)',
      border: '1px solid rgba(0,229,204,0.15)',
      borderRadius: '16px',
      padding: '20px 28px',
      marginBottom: '24px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
    }}>
        <div>
          <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '4px'
        }}>
            <span style={{
            fontSize: '9px',
            fontWeight: '700',
            color: '#00e5cc',
            letterSpacing: '0.3em',
            textTransform: 'uppercase'
          }}>{t("visible.ccdea2d79be2")}</span>
            <div className="badge-active" style={{
            fontSize: '10px',
            padding: '2px 10px'
          }}>
              <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#00ff88',
              display: 'inline-block'
            }}></span>{t("visible.ac7e24813998")}</div>
          </div>
          <h1 style={{
          fontSize: '26px',
          fontWeight: '800',
          color: '#fff',
          letterSpacing: '-0.03em',
          margin: '0 0 4px'
        }}>{t("visible.d7d8682c7aa0")}</h1>
          <p style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.4)',
          margin: 0
        }}>{t("visible.9cb34542f1fc")}<span style={{
            color: '#00e5cc',
            fontWeight: '600'
          }}>{user.name}</span> &mdash; {user.role.toUpperCase()} access
          </p>
        </div>

        <button onClick={logout} style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: '100px',
        padding: '10px 20px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#fca5a5',
        cursor: 'pointer'
      }}>{t("visible.52a2457e608d")}</button>
      </header>

      {errorMsg && <div className="alert-error" style={{
      marginBottom: '20px'
    }}>
          ⚠️ {errorMsg}
        </div>}

      {successMsg && <div className="alert-success" style={{
      marginBottom: '20px'
    }}>
          ✅ {successMsg}
        </div>}

      {/* ADMIN AND SUPERADMIN LAYOUT */}
      {(user.role === 'admin' || user.role === 'superadmin') && <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
          {/* Quick Metrics */}
          {summary && <section className="grid grid-cols-2 lg:grid-cols-4" style={{
        gap: '14px'
      }}>
              {[['📋', 'Total Cases', summary.totalComplaints, 'Active complaints in DB', '#00e5cc'], ['⏳', 'Pending Triage', summary.complaintStatusSummary.submitted, 'New cases awaiting review', '#fbbf24'], ['🔴', 'High Risk Cases', summary.complaintRiskSummary.high, 'Severe threat detections', '#ef4444'], ['🤝', 'Active NGOs', summary.ngoCount, 'Registered responding teams', '#10b981']].map(([icon, title, val, hint, color]) => <div key={title} className="stat-card" style={{
          position: 'relative',
          overflow: 'hidden'
        }}>
                  <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '80px',
            height: '80px',
            background: `radial-gradient(circle, ${color}10 0%, transparent 70%)`,
            borderRadius: '0 16px 0 80px'
          }} />
                  <div style={{
            fontSize: '24px',
            marginBottom: '8px'
          }}>{icon}</div>
                  <div style={{
            fontSize: '11px',
            fontWeight: '700',
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '6px'
          }}>{title}</div>
                  <div style={{
            fontSize: '34px',
            fontWeight: '800',
            color: color,
            lineHeight: 1.1,
            marginBottom: '4px'
          }}>{val ?? '—'}</div>
                  <div style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.3)'
          }}>{hint}</div>
                </div>)}
            </section>}

          {/* Admin Navigation Tabs */}
          <div style={{
        display: 'flex',
        gap: '4px',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
        padding: '6px'
      }}>
            {[['triage', '📋 Triage Queue'], ['ngos', '🤝 NGO Approvals'], ['sos', 'SOS Safety Requests'], ['escalations', '🚨 Escalations'], ['audit', '📊 Audit Logs']].map(([id, label]) => <button key={id} onClick={() => setAdminTab(id)} style={{
          padding: '9px 18px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '600',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          background: adminTab === id ? 'rgba(0,229,204,0.12)' : 'transparent',
          color: adminTab === id ? '#00e5cc' : 'rgba(255,255,255,0.4)',
          boxShadow: adminTab === id ? '0 0 12px rgba(0,229,204,0.15)' : 'none'
        }}>
                {label}
              </button>)}
          </div>

          {/* Tab 1: Triage Queue & Search Filters */}
          {adminTab === 'triage' && <div style={{
        display: 'grid',
        gap: '20px'
      }} className="xl:grid-cols-[1.5fr_0.5fr]">
              {/* Complaints list and search */}
              <div style={{
          background: 'rgba(13,20,32,0.95)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
                <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
                  <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#fff',
              margin: 0
            }}>{t("visible.b0fded5963a3")}</h2>
                  <button onClick={handleExportCSV} className="button-ghost" style={{
              fontSize: '12px',
              padding: '8px 16px'
            }}>{t("visible.6d3e0ba23e79")}</button>
                </div>

                {/* Filters */}
                <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px'
          }}>
                  <input type="text" placeholder={t("visible.8f723c8c4ba1")} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="field-input" style={{
              fontSize: '13px',
              padding: '10px 14px'
            }} />

                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="field-input" style={{
              fontSize: '13px',
              padding: '10px 14px'
            }}>
                    <option value="all">{t("visible.05f567125eb0")}</option>
                    <option value="submitted">{t("visible.64900440a8c9")}</option>
                    <option value="under-review">{t("visible.115fe4ba8ea9")}</option>
                    <option value="resolved">{t("visible.5be3c2c8354e")}</option>
                    <option value="rejected">{t("visible.aea4a04a8042")}</option>
                  </select>

                  <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} className="field-input" style={{
              fontSize: '13px',
              padding: '10px 14px'
            }}>
                    <option value="all">{t("visible.6a81220253b4")}</option>
                    <option value="low">{t("visible.6981968f5957")}</option>
                    <option value="moderate">{t("visible.4a74c2a2a8f0")}</option>
                    <option value="high">{t("visible.604740a26b3f")}</option>
                    <option value="critical">{t("visible.73850df67f04")}</option>
                  </select>
                </div>

                {/* Complaints Table */}
                <div style={{
            overflowX: 'auto'
          }}>
                  <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
                    <thead>
                      <tr style={{
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}>
                        {['Case ID', 'Status', 'Risk', 'Assigned NGO', 'Actions'].map(h => <th key={h} style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontSize: '10px',
                    fontWeight: '700',
                    color: 'rgba(255,255,255,0.35)',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase'
                  }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {complaints.map(c => <tr key={c.anonymousId} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'background 0.2s'
                }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,204,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{
                    padding: '12px 14px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '12px',
                    color: '#00e5cc'
                  }}>
                            {c.anonymousId.slice(0, 13)}...
                          </td>
                          <td style={{
                    padding: '12px 14px'
                  }}>
                            <span style={{
                      padding: '3px 10px',
                      borderRadius: '100px',
                      fontSize: '10px',
                      fontWeight: '700',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      background: c.status === 'resolved' ? 'rgba(16,185,129,0.12)' : c.status === 'under-review' ? 'rgba(59,130,246,0.12)' : 'rgba(251,191,36,0.12)',
                      color: c.status === 'resolved' ? '#10b981' : c.status === 'under-review' ? '#60a5fa' : '#fbbf24',
                      border: `1px solid ${c.status === 'resolved' ? 'rgba(16,185,129,0.25)' : c.status === 'under-review' ? 'rgba(59,130,246,0.25)' : 'rgba(251,191,36,0.25)'}`
                    }}>
                              {c.status}
                            </span>
                          </td>
                          <td style={{
                    padding: '12px 14px'
                  }}>
                            <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: ['critical', 'high'].includes(c.triage?.severity) ? '#ef4444' : c.triage?.severity === 'moderate' ? '#f59e0b' : '#10b981'
                    }}>
                              ● {(c.triage?.severity || 'review required').toUpperCase()}
                            </span>
                          </td>
                          <td style={{
                    padding: '12px 14px',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.5)'
                  }}>
                            {c.assignedNgo?.name || 'Unassigned'}
                          </td>
                          <td style={{
                    padding: '12px 14px'
                  }}>
                            <button onClick={() => handleSelectCase(c)} style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#00e5cc',
                      background: 'rgba(0,229,204,0.08)',
                      border: '1px solid rgba(0,229,204,0.2)',
                      borderRadius: '100px',
                      padding: '4px 12px',
                      cursor: 'pointer'
                    }}>{t("visible.220d6a98efbe")}</button>
                          </td>
                        </tr>)}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-between items-center text-xs text-brand-700 pt-4">
                  <p>{t("visible.515126414a37")}{pagination.page}{t("visible.28391d3bc64e")}{pagination.pages} ({pagination.total}{t("visible.ecb754e53207")}</p>
                  <div className="flex gap-2">
                    <button disabled={pagination.page === 1} onClick={() => setCurrentPage(pagination.page - 1)} className="button-secondary py-1 px-3 disabled:opacity-50">{t("visible.73912999faf4")}</button>
                    <button disabled={pagination.page === pagination.pages} onClick={() => setCurrentPage(pagination.page + 1)} className="button-secondary py-1 px-3 disabled:opacity-50">{t("visible.1ff57a29d7c9")}</button>
                  </div>
                </div>
              </div>

              {/* Sidebar Quick Assignment Overrides */}
              <div className="space-y-6">
                {activeCase ? <div className="surface-panel p-6 space-y-4">
                    <h3 className="text-lg font-bold text-brand-950">{t("visible.8b61bb910ef5")}</h3>
                    <p className="text-xs text-brand-600">{t("visible.13c56f8b7e86")}{activeCase.anonymousId}</p>
                    
                    <div className="space-y-3 pt-3 border-t border-brand-100">
                      <label className="block">
                        <span className="block text-xs font-semibold text-brand-800 mb-1">{t("visible.642dabdc6994")}</span>
                        <select onChange={e => handleAssignNgo(activeCase.anonymousId, e.target.value)} className="field-input py-1 text-xs" defaultValue="">
                          <option value="" disabled>{t("visible.429477d38238")}</option>
                          {ngos.map(ngo => <option key={ngo.ngoId} value={ngo.ngoId}>{ngo.name} ({ngo.district})</option>)}
                        </select>
                      </label>

                      <label className="block">
                        <span className="block text-xs font-semibold text-brand-800 mb-1">{t("visible.7d1b902af591")}</span>
                        <select onChange={e => handleAssignInvestigator(activeCase.anonymousId, e.target.value)} className="field-input py-1 text-xs" defaultValue="">
                          <option value="" disabled>{t("visible.47b0334406c4")}</option>
                          {investigators.map(inv => <option key={inv.investigatorId} value={inv.investigatorId}>{inv.name}{t("visible.ac1c6d4a0d2f")}{inv.badgeNumber})</option>)}
                        </select>
                      </label>
                    </div>
                  </div> : <div className="surface-panel p-6 text-center text-sm text-brand-600">{t("visible.2f7b7bbb1589")}</div>}
              </div>
            </div>}

          {/* Tab 2: NGO Directory & Registration Approvals */}
          {adminTab === 'ngos' && <div className="surface-panel p-6 sm:p-8 space-y-6">
              <h2 className="text-xl font-semibold text-brand-950">{t("visible.5c1f466be37f")}</h2>
              <p className="text-sm text-brand-700">{t("visible.9d8375551e13")}</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-100 text-xs font-bold text-brand-600 uppercase">
                      <th className="py-3 px-4">{t("visible.4a1ea422b0a7")}</th>
                      <th className="py-3 px-4">{t("visible.969ccbd3cf63")}</th>
                      <th className="py-3 px-4">{t("visible.4954aecbbe39")}</th>
                      <th className="py-3 px-4">{t("visible.920e413c7d41")}</th>
                      <th className="py-3 px-4">{t("visible.cc3791639c90")}</th>
                      <th className="py-3 px-4">{t("visible.ff8059dc6752")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100 text-sm">
                    {ngos.map(ngo => <tr key={ngo.ngoId} className="hover:bg-brand-50/50">
                        <td className="py-3 px-4 font-semibold text-brand-950">{ngo.name}</td>
                        <td className="py-3 px-4">{ngo.email}</td>
                        <td className="py-3 px-4">{ngo.district}</td>
                        <td className="py-3 px-4 font-bold text-xs uppercase text-orange-700">{ngo.status}</td>
                        <td className="py-3 px-4">
                          {['submitted', 'under_review'].includes(ngo.status) ? <input type="text" placeholder={t("visible.caa46feb18d8")} value={ngoReviewNote} onChange={e => setNgoReviewNote(e.target.value)} className="field-input py-1 text-xs" /> : <span className="text-xs text-brand-600">{ngo.approvalWorkflow?.notes || 'No review notes'}</span>}
                        </td>
                        <td className="py-3 px-4 flex items-center gap-2">
                          {['submitted', 'under_review'].includes(ngo.status) && <>
                              <button onClick={() => handleNgoReview(ngo.ngoId, 'approved')} className="bg-emerald-600 text-white rounded-full px-3 py-1 text-xs font-bold hover:bg-emerald-700">{t("visible.6007acbe30b2")}</button>
                              <button onClick={() => handleNgoReview(ngo.ngoId, 'rejected')} className="bg-rose-600 text-white rounded-full px-3 py-1 text-xs font-bold hover:bg-rose-700">{t("visible.ab604a360777")}</button>
                            </>}
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </div>}

          {adminTab === 'sos' && <div className="surface-panel p-6 sm:p-8 space-y-6">
              <h2 className="text-xl font-semibold text-brand-950">{t("visible.b6ba9b7196ad")}</h2>
              <p className="text-sm text-brand-700">{t("visible.285ee37e9985")}</p>
              <div className="space-y-3">
                {sosQueue.length ? sosQueue.map(item => <article key={item.sosId} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="font-mono text-xs text-brand-600">{item.caseId}</p>
                    <p className="mt-1 font-semibold capitalize text-rose-950">
                      {item.state.replaceAll('_', ' ')}
                    </p>
                    <p className="mt-2 text-xs text-brand-600">{item.statusNotice}</p>
                    {['routed_internal', 'delivery_unavailable'].includes(item.state) ? <button type="button" className="button-primary mt-3" onClick={() => handleSosAcknowledge(item)}>{t("visible.962d767ecaf2")}</button> : null}
                  </article>) : <p className="text-sm text-brand-600">{t("visible.930c56b352a1")}</p>}
              </div>
            </div>}

          {/* Escalation Inbox */}
          {adminTab === 'escalations' && <div className="surface-panel p-6 sm:p-8 space-y-6">
              <h2 className="text-xl font-semibold text-brand-950">{t("visible.d511bdff5a10")}</h2>
              <p className="text-sm text-brand-700">{t("visible.6e171cc0b472")}</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-100 text-xs font-bold text-brand-600 uppercase">
                      <th className="py-3 px-4">{t("visible.e0aed7cf64e8")}</th>
                      <th className="py-3 px-4">{t("visible.1709305c9fa9")}</th>
                      <th className="py-3 px-4">{t("visible.8b9c643731c9")}</th>
                      <th className="py-3 px-4">{t("visible.920e413c7d41")}</th>
                      <th className="py-3 px-4">{t("visible.76aa212352c3")}</th>
                      <th className="py-3 px-4">{t("visible.64cff1319d2f")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100 text-sm">
                    {escalations.map(esc => <tr key={esc.escalationId} className="hover:bg-brand-50/50">
                        <td className="py-3 px-4 font-mono font-medium">{esc.complaintId}</td>
                        <td className="py-3 px-4 text-brand-950 font-medium">
                          {String(esc.level).replaceAll('_', ' ')}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {String(esc.triggerCategory).replaceAll('_', ' ')}
                        </td>
                        <td className="py-3 px-4 font-bold text-xs uppercase text-rose-700">{esc.status}</td>
                        <td className="py-3 px-4">
                          {esc.status === 'pending' ? <input type="text" placeholder={t("visible.1b924c60618b")} value={resolutionNote} onChange={e => setResolutionNote(e.target.value)} className="field-input py-1 text-xs" /> : <span className="text-xs text-brand-600">
                              {esc.resolutionCategory ? String(esc.resolutionCategory).replaceAll('_', ' ') : t('runtime.noPrivateNote')}
                            </span>}
                        </td>
                        <td className="py-3 px-4">
                          {esc.status === 'pending' && <button onClick={() => handleResolveEscalation(esc)} className="bg-emerald-600 text-white rounded-full px-3 py-1 text-xs font-bold hover:bg-emerald-700">{t("visible.c8f193b315c8")}</button>}
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </div>}

          {/* Tab 4: Audit logs */}
          {adminTab === 'audit' && <div className="surface-panel p-6 sm:p-8 space-y-6">
              <h2 className="text-xl font-semibold text-brand-950">{t("visible.28c858e7d61c")}</h2>
              <p className="text-sm text-brand-700">{t("visible.f1a3e6010c08")}</p>

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-100 text-xs font-bold text-brand-600 uppercase">
                      <th className="py-3 px-4">{t("visible.115a2cc92c10")}</th>
                      <th className="py-3 px-4">{t("visible.5809bbd8a352")}</th>
                      <th className="py-3 px-4">{t("visible.14736a2eb9f4")}</th>
                      <th className="py-3 px-4">{t("visible.64cff1319d2f")}</th>
                      <th className="py-3 px-4">{t("visible.afc2d0d7566b")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100 text-xs font-mono">
                    {auditLogs.map((log, auditIndex) => <tr key={`${log.createdAt}-${auditIndex}`} className="hover:bg-brand-50/50">
                        <td className="py-2 px-4">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="py-2 px-4 font-semibold text-brand-900">{log.actorCategory}</td>
                        <td className="py-2 px-4 uppercase">{log.role}</td>
                        <td className="py-2 px-4 font-semibold text-teal-700">{log.action}</td>
                        <td className="py-2 px-4 truncate max-w-[200px]" title={log.resourceType}>
                          {log.resourceType} &bull; {log.outcome}
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </div>}
        </div>}

      {/* NGO AND INVESTIGATOR LAYOUT */}
      {(user.role === 'ngo' || user.role === 'investigator') && roleDashboardData && <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          {/* Main Case Queue */}
          <div className="surface-panel p-6 sm:p-8 space-y-6">
            <h2 className="text-xl font-semibold text-brand-950">{t("visible.519471c3ae8d")}</h2>
            <p className="text-sm text-brand-700">{t("visible.69f893dad754")}</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-brand-100 text-xs font-bold text-brand-600 uppercase">
                    <th className="py-3 px-4">{t("visible.e0aed7cf64e8")}</th>
                    <th className="py-3 px-4">{t("visible.920e413c7d41")}</th>
                    <th className="py-3 px-4">{t("visible.9939865b0157")}</th>
                    <th className="py-3 px-4">{t("visible.64cff1319d2f")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100 text-sm">
                  {(roleDashboardData.complaints || []).map(c => <tr key={c.anonymousId} className="hover:bg-brand-50/50">
                      <td className="py-3 px-4 font-mono font-medium text-brand-950">{c.anonymousId.slice(0, 15)}...</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700">
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-rose-700">
                        {(c.triage?.severity || 'review required').toUpperCase()}
                      </td>
                      <td className="py-3 px-4">
                        <button onClick={() => handleSelectCase(c)} className="text-xs font-bold text-teal-700 hover:underline">{t("visible.b7c082ac6e46")}</button>
                      </td>
                    </tr>)}
                  {(!roleDashboardData.complaints || roleDashboardData.complaints.length === 0) && <tr>
                      <td colSpan="4" className="py-8 text-center text-sm text-brand-600">{t("visible.a421a8b2c61f")}</td>
                    </tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="space-y-6">
            <div className="surface-panel p-6">
              <h3 className="text-lg font-bold text-brand-950">{t("visible.197c597c5251")}</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-brand-100 p-4 text-center">
                  <p className="text-xs text-brand-600">{t("visible.3417b94536db")}</p>
                  <p className="text-3xl font-bold text-brand-950 mt-1">{roleDashboardData.metrics?.totalAssigned || 0}</p>
                </div>
                <div className="rounded-2xl border border-brand-100 p-4 text-center">
                  <p className="text-xs text-brand-600">{t("visible.97f28fb8c055")}</p>
                  <p className="text-3xl font-bold text-teal-700 mt-1">
                    {roleDashboardData.metrics?.activeCases !== undefined ? roleDashboardData.metrics.activeCases : roleDashboardData.metrics?.openCases || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>}

      {/* UNIVERSAL OPERATOR WORKSPACE (Detail view drawer/modal for selected complaint) */}
      {activeCase && <section className="mt-8 surface-panel p-6 sm:p-8 space-y-6 border-2 border-teal-500 animate-rise">
          <div className="flex justify-between items-start border-b border-brand-100 pb-4">
            <div>
              <span className="eyebrow">{t("visible.a95c9a7c6b31")}</span>
              <h2 className="text-2xl font-bold text-brand-950 mt-1">{t("visible.13c56f8b7e86")}{activeCase.anonymousId}
              </h2>
            </div>
            <button onClick={() => {
          setActiveCase(null);
          setActiveCaseTimeline([]);
          setActiveCaseEvidence([]);
          setChatMessages([]);
        }} className="text-xs font-semibold bg-brand-100 text-brand-800 hover:bg-brand-200 px-3 py-1 rounded-full">{t("visible.8eef2d1991ea")}</button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            {/* Left: Case Triage, AI recommendations, Note Updates */}
            <div className="space-y-6">
              {/* Triage Analytics */}
              <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4 space-y-3">
                <h4 className="font-bold text-brand-950 text-sm">{t("visible.833091fcd624")}</h4>
                <p className="text-xs text-brand-800">
                  <span className="font-semibold">{t("visible.4c4a6fee48ad")}</span> {(activeCase.triage?.severity || 'review required').toUpperCase()}
                </p>
                <p className="text-xs text-brand-800">
                  <span className="font-semibold">{t("visible.7a6b9bef0e40")}</span> {activeCase.triage?.reviewState || 'review_required'}
                </p>
                {isAdministrator && activeCase.triage?.assessmentId ? <div className="mt-4 space-y-3 rounded-xl border border-brand-200 p-4">
                  <p className="text-sm font-semibold">{t("visible.47b5ef5080ed")}</p>
                  <button className="button-secondary" onClick={() => handleTriageReview('confirm')}>{t("visible.e22c4e28823b")}</button>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select className="field-input" value={triageSeverity} onChange={e => setTriageSeverity(e.target.value)}>
                      <option value="low">{t("visible.f793de205ead")}</option><option value="moderate">{t("visible.5c42afc7a230")}</option>
                      <option value="high">{t("visible.c4ebc6d4a583")}</option><option value="critical">{t("visible.427dd2969bd1")}</option>
                    </select>
                    <select className="field-input" value={triageReason} onChange={e => setTriageReason(e.target.value)}>
                      <option value="new_information">{t("visible.1f69c6ba83a6")}</option>
                      <option value="reporter_clarification">{t("visible.24df137c686e")}</option>
                      <option value="incorrect_structured_input">{t("visible.415788c58c9f")}</option>
                      <option value="policy_misclassification">{t("visible.c6cb716c2669")}</option>
                      <option value="danger_no_longer_current">{t("visible.7536c8634f2b")}</option>
                      <option value="insufficient_information">{t("visible.fbe5f2132bf2")}</option>
                    </select>
                  </div>
                  <textarea className="field-input" value={triageNote} onChange={e => setTriageNote(e.target.value)} placeholder={t("visible.a2cdc0d1043c")} maxLength={1000} />
                  <button className="button-primary" disabled={!triageNote.trim()} onClick={() => handleTriageReview('override')}>{t("visible.4878b1634dbd")}</button>
                  {triageHistory.length ? <p className="text-xs text-brand-600">{t("visible.4f05ffe5938c")}{triageHistory.map(item => item.version).join(', ')}
                  </p> : null}
                </div> : null}

                {(isAdministrator || user.role === 'investigator') && <div className="flex flex-wrap gap-2 pt-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeCase.indicators?.dowryHarassment ? 'bg-red-100 text-red-800' : 'bg-brand-100 text-brand-600'}`}>{t("visible.268aff418624")}{activeCase.indicators?.dowryHarassment ? t('runtime.detected') : t('runtime.cleared')}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeCase.indicators?.suicideRisk ? 'bg-red-100 text-red-800' : 'bg-brand-100 text-brand-600'}`}>{t("visible.0eb64ecaf7f4")}{activeCase.indicators?.suicideRisk ? t('runtime.triggered') : t('runtime.cleared')}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeCase.indicators?.domesticViolence ? 'bg-red-100 text-red-800' : 'bg-brand-100 text-brand-600'}`}>{t("visible.67fe9fe7a419")}{activeCase.indicators?.domesticViolence ? t('runtime.detected') : t('runtime.cleared')}
                  </span>
                </div>}
              </div>

              {/* Status Update selectors */}
              {user.role === 'ngo' && !activeCase.assignedNgo?.acknowledgedAt && <button type="button" onClick={handleAcknowledgeNgoAssignment} className="button-primary px-4 py-2 text-xs">{t("visible.bb88bd480235")}</button>}
              {isAdministrator && <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold text-brand-800">{t("visible.b7a7dd8a0257")}</span>
                {['submitted', 'under-review', 'resolved', 'rejected'].map(st => <button key={st} onClick={() => handleStatusUpdate(st)} className={`px-3 py-1 rounded-full text-xs font-bold ${activeCase.status === st ? 'bg-brand-950 text-white' : 'bg-brand-50 border border-brand-200 text-brand-800 hover:bg-brand-100'}`}>
                    {st.toUpperCase()}
                  </button>)}
              </div>}

              {/* Structured internal workflow request */}
              {isAdministrator && <form onSubmit={handleEscalateCase} className="p-4 rounded-2xl border border-rose-100 bg-rose-50/50 space-y-3">
                  <h4 className="font-bold text-rose-950 text-sm">{t("visible.77115addf505")}</h4>
                  <select value={escalationReason} onChange={e => setEscalationReason(e.target.value)} className="field-input py-1.5 text-xs bg-white">
                    <option value="administrative_review">{t("visible.9d54378cdf64")}</option>
                    <option value="new_information">{t("visible.1f69c6ba83a6")}</option>
                    <option value="assignment_attention">{t("visible.e82405e1dd5b")}</option>
                    <option value="human_review_requested">{t("visible.bb9042ab8ec0")}</option>
                    <option value="unresolved_case">{t("visible.97ff306c9233")}</option>
                  </select>
                  <button type="submit" className="bg-rose-700 text-white rounded-full px-4 py-2 text-xs font-bold hover:bg-rose-800">{t("visible.8c272b760bc1")}</button>
                  <p className="text-xs text-rose-800">{t("visible.a392f528bd95")}</p>
                </form>}

              {/* Investigation notes addition */}
              <div className="space-y-4 pt-4 border-t border-brand-100">
                <h4 className="font-bold text-brand-950 text-sm">{t("visible.1fc477d02086")}</h4>
                
                {/* Notes list */}
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                  {activeCaseTimeline.map((item, timelineIndex) => <div key={`${item.createdAt}-${item.action}-${timelineIndex}`} className="text-xs bg-white border border-brand-100 p-2.5 rounded-xl">
                      <p className="text-brand-500 font-medium">
                        {new Date(item.createdAt).toLocaleString()} &bull; {item.actorName} ({item.actorRole.toUpperCase()})
                      </p>
                      <p className="mt-1 text-brand-900 font-semibold">{item.action.replace('_', ' ').toUpperCase()}</p>
                      <p className="mt-1 text-brand-700">{item.description}</p>
                    </div>)}
                </div>

                {/* Add note form */}
                {user.role === 'investigator' && <form onSubmit={handleAddNote} className="flex gap-2">
                  <input required type="text" placeholder={t("visible.3ac471363dea")} value={investigationNoteInput} onChange={e => setInvestigationNoteInput(e.target.value)} className="field-input py-2 text-xs" />
                  <button type="submit" disabled={isAddingNote || !investigationNoteInput.trim()} className="button-primary px-4 py-2 text-xs shrink-0 disabled:opacity-50">
                    {isAddingNote ? t('runtime.saving') : t('runtime.addNote')}
                  </button>
                </form>}
              </div>

              <div className="space-y-3 border-t border-brand-100 pt-4">
                <h4 className="font-bold text-brand-950 text-sm">{t("visible.9f4818ed7973")}</h4>
                {activeCaseEvidence.map(evidence => <div key={evidence.evidenceId || `${evidence.createdAt}-${evidence.originalName}`} className="rounded-xl border border-brand-100 bg-white p-3 text-xs">
                    <p className="font-semibold text-brand-900">{evidence.originalName}</p>
                    <p className="capitalize text-brand-600">
                      {evidence.lifecycleStatus.replaceAll('_', ' ')}
                      {evidence.scanStatus === 'not_configured' ? ' · scanning not configured' : ''}
                    </p>
                    {evidence.lifecycleStatus === 'available' && evidence.downloadPath && <button type="button" onClick={() => handleStaffEvidenceDownload(evidence)} className="button-secondary mt-2 px-3 py-1 text-xs">
                        {downloadingEvidenceId === evidence.evidenceId ? t('runtime.downloading') : t('runtime.authorizedDownload')}
                      </button>}
                  </div>)}
                <form onSubmit={handleStaffEvidenceUpload} className="flex gap-2">
                  <input type="file" required accept=".jpg,.jpeg,.png,.webp" onChange={event => setStaffEvidenceFile(event.target.files?.[0] || null)} className="block w-full text-xs" />
                  <button type="submit" disabled={!staffEvidenceFile} className="button-primary px-3 py-1 text-xs">{t("visible.865e89de78d9")}</button>
                </form>
              </div>
            </div>

            {/* Right: secure Chat Panel with reporter */}
            <div className="surface-panel p-4 flex flex-col h-[450px]">
              <div className="border-b border-brand-100 pb-2">
                <h4 className="font-bold text-brand-950 text-sm">{t("visible.cc7a6e246648")}</h4>
                <p className="text-[10px] text-brand-500 uppercase">{t("visible.8e516cb4eb5d")}</p>
              </div>

              {/* Messages area */}
              <p className="text-xs text-brand-600" aria-live="polite">{t("visible.0e430a1a078f")}{chatConnectionState.replaceAll('_', ' ')}{t("visible.738845d10ba8")}</p>
              <div className="flex-1 overflow-y-auto my-3 space-y-3 pr-1">
                {chatMessages.map((msg, messageIndex) => {
              const isOwnMessage = msg.senderRole === user.role;
              return <div key={`${msg.createdAt}-${messageIndex}`} className={`flex flex-col max-w-[85%] ${isOwnMessage ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                      <span className="text-[9px] text-brand-600 uppercase mb-0.5 px-1">
                        {msg.senderName} ({msg.senderRole.toUpperCase()})
                      </span>
                      <div className={`rounded-2xl px-4 py-2 text-xs ${isOwnMessage ? 'bg-brand-950 text-white rounded-tr-none' : 'bg-brand-50 border border-brand-100 text-brand-950 rounded-tl-none'}`}>
                        {msg.text}
                      </div>
                      <span className="text-[8px] text-brand-500 mt-0.5 px-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                      </span>
                    </div>;
            })}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input required type="text" placeholder={t("visible.4afe797b8916")} value={chatInput} onChange={e => setChatInput(e.target.value)} className="field-input py-2 text-xs" />
                <button type="submit" disabled={isSendingChat || !chatInput.trim()} className="button-primary px-4 py-2 text-xs shrink-0 disabled:opacity-50">
                  {isSendingChat ? t('runtime.sending') : t('runtime.send')}
                </button>
              </form>
            </div>
          </div>
        </section>}
    </div>;
}
