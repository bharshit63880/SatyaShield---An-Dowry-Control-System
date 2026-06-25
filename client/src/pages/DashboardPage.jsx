import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  getDashboardComplaints,
  getDashboardSummary,
  updateDashboardComplaintStatusRequest,
  listNgosRequest,
  reviewNgoRequest,
  listInvestigatorsRequest,
  getAuditLogsRequest,
  getEscalationsRequest,
  resolveEscalationRequest,
  assignNgoRequest,
  assignInvestigatorRequest,
  escalateComplaintRequest,
  getChatMessagesRequest,
  sendChatMessageRequest,
  addInvestigationNoteRequest,
  getComplaintTimelineRequest,
  getNgoDashboardRequest,
  getInvestigatorDashboardRequest
} from '../services/api';

export function DashboardPage() {
  const { token, user, logout } = useAuth();
  
  // Base state
  const [summary, setSummary] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  // NGO & Investigator dashboard-specific states
  const [roleDashboardData, setRoleDashboardData] = useState(null);

  // Active Case Detail View Modal / Drawer State
  const [activeCase, setActiveCase] = useState(null);
  const [activeCaseTimeline, setActiveCaseTimeline] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [investigationNoteInput, setInvestigationNoteInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Modal actions (approvals / escalations)
  const [escalationReason, setEscalationReason] = useState('');
  const [ngoReviewNote, setNgoReviewNote] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  const deferredSearch = useDeferredValue(searchTerm);

  // Load directories and data based on Role
  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      setIsLoading(true);
      setErrorMsg('');
      try {
        if (user.role === 'admin' || user.role === 'superadmin') {
          const [summaryRes, ngoRes, invRes, escRes, auditRes] = await Promise.all([
            getDashboardSummary(token),
            listNgosRequest(token),
            listInvestigatorsRequest(token),
            getEscalationsRequest(token),
            getAuditLogsRequest(token, 1, 50)
          ]);

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
          setErrorMsg(err.message || 'Failed to initialize dashboard.');
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
          setErrorMsg(err.message || 'Failed to fetch complaints.');
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
      await reviewNgoRequest(token, id, status, ngoReviewNote);
      setSuccessMsg(`NGO successfully ${status}.`);
      setNgoReviewNote('');
      const ngoRes = await listNgosRequest(token);
      setNgos(ngoRes.data.ngos);
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  // Handle Case Escalation Resolution
  async function handleResolveEscalation(id) {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await resolveEscalationRequest(token, id, resolutionNote);
      setSuccessMsg('Escalation resolved successfully.');
      setResolutionNote('');
      const escRes = await getEscalationsRequest(token);
      setEscalations(escRes.data.escalations);
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  // Handle NGO assignment override
  async function handleAssignNgo(anonymousId, ngoId) {
    setErrorMsg('');
    try {
      await assignNgoRequest(token, anonymousId, ngoId);
      setSuccessMsg('NGO assigned successfully.');
      // Refresh complaints queue
      const response = await getDashboardComplaints(token, { status: statusFilter, riskLevel: riskFilter, page: currentPage });
      setComplaints(response.data.complaints);
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  // Handle Investigator assignment
  async function handleAssignInvestigator(anonymousId, investigatorId) {
    setErrorMsg('');
    try {
      await assignInvestigatorRequest(token, anonymousId, investigatorId);
      setSuccessMsg('Investigator assigned successfully.');
      const response = await getDashboardComplaints(token, { status: statusFilter, riskLevel: riskFilter, page: currentPage });
      setComplaints(response.data.complaints);
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  // Handle Escalating a complaint
  async function handleEscalateCase(e) {
    e.preventDefault();
    if (!activeCase || !escalationReason) return;
    setErrorMsg('');
    try {
      await escalateComplaintRequest(token, activeCase.anonymousId, escalationReason);
      setSuccessMsg('Case escalated successfully.');
      setEscalationReason('');
      // Refresh timeline
      const timelineRes = await getComplaintTimelineRequest(activeCase.anonymousId);
      setActiveCaseTimeline(timelineRes.data.history);
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  // Select a Case for Detailed view / Chat / Notes
  async function handleSelectCase(c) {
    setErrorMsg('');
    setSuccessMsg('');
    setActiveCase(c);
    try {
      const [timelineRes, chatRes] = await Promise.all([
        getComplaintTimelineRequest(c.anonymousId),
        getChatMessagesRequest(token, c.anonymousId)
      ]);
      setActiveCaseTimeline(timelineRes.data.history);
      setChatMessages(chatRes.data.messages);
    } catch (err) {
      setErrorMsg('Failed to load timeline or chat messages.');
    }
  }

  // Submit Chat message
  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatInput.trim() || !activeCase) return;
    setIsSendingChat(true);
    try {
      const chatRes = await sendChatMessageRequest(token, activeCase.anonymousId, chatInput.trim());
      setChatMessages((prev) => [...prev, chatRes.data.message]);
      setChatInput('');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSendingChat(false);
    }
  }

  // Submit Investigation Note
  async function handleAddNote(e) {
    e.preventDefault();
    if (!investigationNoteInput.trim() || !activeCase) return;
    setIsAddingNote(true);
    try {
      await addInvestigationNoteRequest(token, activeCase.anonymousId, investigationNoteInput.trim());
      setInvestigationNoteInput('');
      const timelineRes = await getComplaintTimelineRequest(activeCase.anonymousId);
      setActiveCaseTimeline(timelineRes.data.history);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsAddingNote(false);
    }
  }

  // Update Case status
  async function handleStatusUpdate(status) {
    if (!activeCase) return;
    setErrorMsg('');
    try {
      const res = await updateDashboardComplaintStatusRequest(token, activeCase.anonymousId, status);
      setActiveCase(res.data.complaint);
      
      // Refresh complaints and timeline
      const [timelineRes, complRes] = await Promise.all([
        getComplaintTimelineRequest(activeCase.anonymousId),
        getDashboardComplaints(token, { status: statusFilter, riskLevel: riskFilter, page: currentPage })
      ]);
      setActiveCaseTimeline(timelineRes.data.history);
      setComplaints(complRes.data.complaints);
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  // Export Complaints to CSV
  function handleExportCSV() {
    if (complaints.length === 0) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'AnonymousID,Status,RiskLevel,Timestamp,Description,AssignedNGO,AssignedInvestigator\n';
    
    complaints.forEach((c) => {
      const cleanDesc = c.description.replace(/"/g, '""');
      csvContent += `"${c.anonymousId}","${c.status}","${c.riskLevel}","${c.timestamp}","${cleanDesc}","${c.assignedNgo?.name || 'None'}","${c.assignedInvestigator?.name || 'None'}"\n`;
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
    return (
      <div className="page-shell py-16" style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
        }}>
          <div style={{
            width: '56px', height: '56px',
            border: '3px solid rgba(0,229,204,0.15)',
            borderTopColor: '#00e5cc',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Accessing SatyaShield operational environment...</p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'rgba(0,229,204,0.4)' }}>Authenticating session...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      {/* Header Panel */}
      <header style={{
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '16px',
        background: 'rgba(13,20,32,0.95)',
        border: '1px solid rgba(0,229,204,0.15)',
        borderRadius: '16px',
        padding: '20px 28px',
        marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '9px', fontWeight: '700', color: '#00e5cc', letterSpacing: '0.3em', textTransform: 'uppercase' }}>⬡ Secure Workspace</span>
            <div className="badge-active" style={{ fontSize: '10px', padding: '2px 10px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', display: 'inline-block' }}></span>
              ONLINE
            </div>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.03em', margin: '0 0 4px' }}>
            🛡️ Operational Dashboard
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Authenticated as <span style={{ color: '#00e5cc', fontWeight: '600' }}>{user.name}</span> &mdash; {user.role.toUpperCase()} access
          </p>
        </div>

        <button onClick={logout} style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '100px',
          padding: '10px 20px',
          fontSize: '13px', fontWeight: '600',
          color: '#fca5a5',
          cursor: 'pointer'
        }}>
          🚪 Sign Out Portal
        </button>
      </header>

      {errorMsg && (
        <div className="alert-error" style={{ marginBottom: '20px' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="alert-success" style={{ marginBottom: '20px' }}>
          ✅ {successMsg}
        </div>
      )}

      {/* ADMIN AND SUPERADMIN LAYOUT */}
      {(user.role === 'admin' || user.role === 'superadmin') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Quick Metrics */}
          {summary && (
            <section className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '14px' }}>
              {[
                ['📋', 'Total Cases', summary.totalComplaints, 'Active complaints in DB', '#00e5cc'],
                ['⏳', 'Pending Triage', summary.complaintStatusSummary.submitted, 'New cases awaiting review', '#fbbf24'],
                ['🔴', 'High Risk Cases', summary.complaintRiskSummary.high, 'Severe threat detections', '#ef4444'],
                ['🤝', 'Active NGOs', summary.ngoCount, 'Registered responding teams', '#10b981']
              ].map(([icon, title, val, hint, color]) => (
                <div key={title} className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', top: 0, right: 0,
                    width: '80px', height: '80px',
                    background: `radial-gradient(circle, ${color}10 0%, transparent 70%)`,
                    borderRadius: '0 16px 0 80px'
                  }} />
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '6px' }}>{title}</div>
                  <div style={{ fontSize: '34px', fontWeight: '800', color: color, lineHeight: 1.1, marginBottom: '4px' }}>{val ?? '—'}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{hint}</div>
                </div>
              ))}
            </section>
          )}

          {/* Admin Navigation Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '6px' }}>
            {[
              ['triage', '📋 Triage Queue'],
              ['ngos', '🤝 NGO Approvals'],
              ['escalations', '🚨 Escalations'],
              ['audit', '📊 Audit Logs']
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setAdminTab(id)}
                style={{
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
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab 1: Triage Queue & Search Filters */}
          {adminTab === 'triage' && (
            <div style={{ display: 'grid', gap: '20px' }} className="xl:grid-cols-[1.5fr_0.5fr]">
              {/* Complaints list and search */}
              <div style={{
                background: 'rgba(13,20,32,0.95)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '16px',
                padding: '28px',
                display: 'flex', flexDirection: 'column', gap: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 }}>📋 Active Case Queue</h2>
                  <button onClick={handleExportCSV} className="button-ghost" style={{ fontSize: '12px', padding: '8px 16px' }}>
                    📥 Export CSV
                  </button>
                </div>

                {/* Filters */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <input
                    type="text"
                    placeholder="Search by ID or keywords..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="field-input"
                    style={{ fontSize: '13px', padding: '10px 14px' }}
                  />

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="field-input"
                    style={{ fontSize: '13px', padding: '10px 14px' }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="under-review">Under Review</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                    className="field-input"
                    style={{ fontSize: '13px', padding: '10px 14px' }}
                  >
                    <option value="all">All Risks</option>
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                </div>

                {/* Complaints Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['Case ID', 'Status', 'Risk', 'Assigned NGO', 'Actions'].map(h => (
                          <th key={h} style={{
                            padding: '10px 14px', textAlign: 'left',
                            fontSize: '10px', fontWeight: '700',
                            color: 'rgba(255,255,255,0.35)',
                            letterSpacing: '0.15em', textTransform: 'uppercase'
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {complaints.map((c) => (
                        <tr key={c.anonymousId} style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          transition: 'background 0.2s'
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,204,0.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#00e5cc' }}>
                            {c.anonymousId.slice(0, 13)}...
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '100px',
                              fontSize: '10px', fontWeight: '700',
                              letterSpacing: '0.08em', textTransform: 'uppercase',
                              background: c.status === 'resolved' ? 'rgba(16,185,129,0.12)' :
                                c.status === 'under-review' ? 'rgba(59,130,246,0.12)' : 'rgba(251,191,36,0.12)',
                              color: c.status === 'resolved' ? '#10b981' :
                                c.status === 'under-review' ? '#60a5fa' : '#fbbf24',
                              border: `1px solid ${c.status === 'resolved' ? 'rgba(16,185,129,0.25)' :
                                c.status === 'under-review' ? 'rgba(59,130,246,0.25)' : 'rgba(251,191,36,0.25)'}`
                            }}>
                              {c.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              fontSize: '11px', fontWeight: '700',
                              color: c.riskLevel === 'high' ? '#ef4444' :
                                c.riskLevel === 'medium' ? '#f59e0b' : '#10b981'
                            }}>
                              ● {c.riskLevel.toUpperCase()} ({c.riskScore})
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                            {c.assignedNgo?.name || 'Unassigned'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <button
                              onClick={() => handleSelectCase(c)}
                              style={{
                                fontSize: '11px', fontWeight: '700',
                                color: '#00e5cc',
                                background: 'rgba(0,229,204,0.08)',
                                border: '1px solid rgba(0,229,204,0.2)',
                                borderRadius: '100px',
                                padding: '4px 12px',
                                cursor: 'pointer'
                              }}
                            >
                              Triage →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-between items-center text-xs text-brand-700 pt-4">
                  <p>Showing Page {pagination.page} of {pagination.pages} ({pagination.total} cases)</p>
                  <div className="flex gap-2">
                    <button
                      disabled={pagination.page === 1}
                      onClick={() => setCurrentPage(pagination.page - 1)}
                      className="button-secondary py-1 px-3 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      disabled={pagination.page === pagination.pages}
                      onClick={() => setCurrentPage(pagination.page + 1)}
                      className="button-secondary py-1 px-3 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar Quick Assignment Overrides */}
              <div className="space-y-6">
                {activeCase ? (
                  <div className="surface-panel p-6 space-y-4">
                    <h3 className="text-lg font-bold text-brand-950">Override Routing</h3>
                    <p className="text-xs text-brand-600">Case ID: {activeCase.anonymousId}</p>
                    
                    <div className="space-y-3 pt-3 border-t border-brand-100">
                      <label className="block">
                        <span className="block text-xs font-semibold text-brand-800 mb-1">Assign NGO Match</span>
                        <select
                          onChange={(e) => handleAssignNgo(activeCase.anonymousId, e.target.value)}
                          className="field-input py-1 text-xs"
                          defaultValue=""
                        >
                          <option value="" disabled>Select NGO</option>
                          {ngos.map((ngo) => (
                            <option key={ngo._id} value={ngo._id}>{ngo.name} ({ngo.district})</option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="block text-xs font-semibold text-brand-800 mb-1">Assign Investigator</span>
                        <select
                          onChange={(e) => handleAssignInvestigator(activeCase.anonymousId, e.target.value)}
                          className="field-input py-1 text-xs"
                          defaultValue=""
                        >
                          <option value="" disabled>Select Investigator</option>
                          {investigators.map((inv) => (
                            <option key={inv._id} value={inv.userId}>{inv.name} (Badge: {inv.badgeNumber})</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="surface-panel p-6 text-center text-sm text-brand-600">
                    Select a case from the triage queue to modify assignments on the fly.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: NGO Directory & Registration Approvals */}
          {adminTab === 'ngos' && (
            <div className="surface-panel p-6 sm:p-8 space-y-6">
              <h2 className="text-xl font-semibold text-brand-950">Partner NGO Approvals</h2>
              <p className="text-sm text-brand-700">Review pending registrations and approve access key distributions.</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-100 text-xs font-bold text-brand-600 uppercase">
                      <th className="py-3 px-4">NGO Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">HQ District</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Notes Review</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100 text-sm">
                    {ngos.map((ngo) => (
                      <tr key={ngo._id} className="hover:bg-brand-50/50">
                        <td className="py-3 px-4 font-semibold text-brand-950">{ngo.name}</td>
                        <td className="py-3 px-4">{ngo.email}</td>
                        <td className="py-3 px-4">{ngo.district}</td>
                        <td className="py-3 px-4 font-bold text-xs uppercase text-orange-700">{ngo.status}</td>
                        <td className="py-3 px-4">
                          {ngo.status === 'pending' ? (
                            <input
                              type="text"
                              placeholder="Review justification note..."
                              value={ngoReviewNote}
                              onChange={(e) => setNgoReviewNote(e.target.value)}
                              className="field-input py-1 text-xs"
                            />
                          ) : (
                            <span className="text-xs text-brand-600">{ngo.approvalWorkflow?.notes || 'No review notes'}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 flex items-center gap-2">
                          {ngo.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleNgoReview(ngo._id, 'approved')}
                                className="bg-emerald-600 text-white rounded-full px-3 py-1 text-xs font-bold hover:bg-emerald-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleNgoReview(ngo._id, 'rejected')}
                                className="bg-rose-600 text-white rounded-full px-3 py-1 text-xs font-bold hover:bg-rose-700"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Escalation Inbox */}
          {adminTab === 'escalations' && (
            <div className="surface-panel p-6 sm:p-8 space-y-6">
              <h2 className="text-xl font-semibold text-brand-950">Escalation Center</h2>
              <p className="text-sm text-brand-700">View cases flagged for immediate Admin oversight.</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-100 text-xs font-bold text-brand-600 uppercase">
                      <th className="py-3 px-4">Case ID</th>
                      <th className="py-3 px-4">Reason for Escalation</th>
                      <th className="py-3 px-4">Raised By</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Resolution Note</th>
                      <th className="py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100 text-sm">
                    {escalations.map((esc) => (
                      <tr key={esc._id} className="hover:bg-brand-50/50">
                        <td className="py-3 px-4 font-mono font-medium">{esc.complaintId}</td>
                        <td className="py-3 px-4 text-brand-950 font-medium">{esc.reason}</td>
                        <td className="py-3 px-4 text-xs">{esc.raisedByName} ({esc.raisedByRole.toUpperCase()})</td>
                        <td className="py-3 px-4 font-bold text-xs uppercase text-rose-700">{esc.status}</td>
                        <td className="py-3 px-4">
                          {esc.status === 'pending' ? (
                            <input
                              type="text"
                              placeholder="Describe resolution action..."
                              value={resolutionNote}
                              onChange={(e) => setResolutionNote(e.target.value)}
                              className="field-input py-1 text-xs"
                            />
                          ) : (
                            <span className="text-xs text-brand-600">{esc.resolution || 'No note'}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {esc.status === 'pending' && (
                            <button
                              onClick={() => handleResolveEscalation(esc._id)}
                              className="bg-emerald-600 text-white rounded-full px-3 py-1 text-xs font-bold hover:bg-emerald-700"
                            >
                              Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 4: Audit logs */}
          {adminTab === 'audit' && (
            <div className="surface-panel p-6 sm:p-8 space-y-6">
              <h2 className="text-xl font-semibold text-brand-950">Administrative Audit Logs</h2>
              <p className="text-sm text-brand-700">Chronological tracing of all database queries and updates.</p>

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-100 text-xs font-bold text-brand-600 uppercase">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">User Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">IP / Browser UA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100 text-xs font-mono">
                    {auditLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-brand-50/50">
                        <td className="py-2 px-4">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="py-2 px-4 font-semibold text-brand-900">{log.userEmail}</td>
                        <td className="py-2 px-4 uppercase">{log.role}</td>
                        <td className="py-2 px-4 font-semibold text-teal-700">{log.action}</td>
                        <td className="py-2 px-4 truncate max-w-[200px]" title={log.userAgent}>
                          {log.ipAddress} &bull; {log.userAgent}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NGO AND INVESTIGATOR LAYOUT */}
      {(user.role === 'ngo' || user.role === 'investigator') && roleDashboardData && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          {/* Main Case Queue */}
          <div className="surface-panel p-6 sm:p-8 space-y-6">
            <h2 className="text-xl font-semibold text-brand-950">Assigned Complaints Portfolio</h2>
            <p className="text-sm text-brand-700">Select a case from the index table to read details and chat with the reporter.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-brand-100 text-xs font-bold text-brand-600 uppercase">
                    <th className="py-3 px-4">Case ID</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Priority Risk</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100 text-sm">
                  {(roleDashboardData.complaints || []).map((c) => (
                    <tr key={c.anonymousId} className="hover:bg-brand-50/50">
                      <td className="py-3 px-4 font-mono font-medium text-brand-950">{c.anonymousId.slice(0, 15)}...</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700">
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-rose-700">{c.riskLevel.toUpperCase()} ({c.riskScore})</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleSelectCase(c)}
                          className="text-xs font-bold text-teal-700 hover:underline"
                        >
                          Open Workspace
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!roleDashboardData.complaints || roleDashboardData.complaints.length === 0) && (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-sm text-brand-600">
                        No complaints assigned to your jurisdiction queue.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="space-y-6">
            <div className="surface-panel p-6">
              <h3 className="text-lg font-bold text-brand-950">Assignment Summary</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-brand-100 p-4 text-center">
                  <p className="text-xs text-brand-600">Total Cases</p>
                  <p className="text-3xl font-bold text-brand-950 mt-1">{roleDashboardData.metrics?.totalAssigned || 0}</p>
                </div>
                <div className="rounded-2xl border border-brand-100 p-4 text-center">
                  <p className="text-xs text-brand-600">Active Cases</p>
                  <p className="text-3xl font-bold text-teal-700 mt-1">
                    {roleDashboardData.metrics?.activeCases !== undefined ? roleDashboardData.metrics.activeCases : roleDashboardData.metrics?.openCases || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UNIVERSAL OPERATOR WORKSPACE (Detail view drawer/modal for selected complaint) */}
      {activeCase && (
        <section className="mt-8 surface-panel p-6 sm:p-8 space-y-6 border-2 border-teal-500 animate-rise">
          <div className="flex justify-between items-start border-b border-brand-100 pb-4">
            <div>
              <span className="eyebrow">Interactive Case Desk</span>
              <h2 className="text-2xl font-bold text-brand-950 mt-1">
                Case ID: {activeCase.anonymousId}
              </h2>
            </div>
            <button
              onClick={() => setActiveCase(null)}
              className="text-xs font-semibold bg-brand-100 text-brand-800 hover:bg-brand-200 px-3 py-1 rounded-full"
            >
              Close Workspace
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            {/* Left: Case Triage, AI recommendations, Note Updates */}
            <div className="space-y-6">
              {/* Triage Analytics */}
              <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4 space-y-3">
                <h4 className="font-bold text-brand-950 text-sm">AI Risk Assessment</h4>
                <p className="text-xs text-brand-800">
                  <span className="font-semibold">Threat Level:</span> {activeCase.riskLevel.toUpperCase()} (Score: {activeCase.riskScore})
                </p>
                <p className="text-xs text-brand-800">
                  <span className="font-semibold">Threat Summary:</span> {activeCase.threatSummary}
                </p>
                <p className="text-xs text-brand-800">
                  <span className="font-semibold">Action Recommendation:</span> {activeCase.escalationRecommendation}
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeCase.indicators?.dowryHarassment ? 'bg-red-100 text-red-800' : 'bg-brand-100 text-brand-600'}`}>
                    Dowry Harassment: {activeCase.indicators?.dowryHarassment ? 'DETECTED' : 'CLEARED'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeCase.indicators?.suicideRisk ? 'bg-red-100 text-red-800' : 'bg-brand-100 text-brand-600'}`}>
                    Suicide/Self-Harm: {activeCase.indicators?.suicideRisk ? 'TRIGGERED' : 'CLEARED'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeCase.indicators?.domesticViolence ? 'bg-red-100 text-red-800' : 'bg-brand-100 text-brand-600'}`}>
                    Domestic Violence: {activeCase.indicators?.domesticViolence ? 'DETECTED' : 'CLEARED'}
                  </span>
                </div>
              </div>

              {/* Status Update selectors */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold text-brand-800">Update Status:</span>
                {['submitted', 'under-review', 'resolved', 'rejected'].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusUpdate(st)}
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      activeCase.status === st ? 'bg-brand-950 text-white' : 'bg-brand-50 border border-brand-200 text-brand-800 hover:bg-brand-100'
                    }`}
                  >
                    {st.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Escalation Trigger form (NGO/Investigator to raise to admin) */}
              {user.role !== 'admin' && user.role !== 'superadmin' && (
                <form onSubmit={handleEscalateCase} className="p-4 rounded-2xl border border-rose-100 bg-rose-50/50 space-y-3">
                  <h4 className="font-bold text-rose-950 text-sm">Escalate Case to Admin</h4>
                  <input
                    required
                    type="text"
                    placeholder="Provide justification for immediate escalation..."
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    className="field-input py-1.5 text-xs bg-white"
                  />
                  <button type="submit" className="bg-rose-700 text-white rounded-full px-4 py-2 text-xs font-bold hover:bg-rose-800">
                    Submit Urgent Escalation
                  </button>
                </form>
              )}

              {/* Investigation notes addition */}
              <div className="space-y-4 pt-4 border-t border-brand-100">
                <h4 className="font-bold text-brand-950 text-sm">Timeline Case History</h4>
                
                {/* Notes list */}
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                  {activeCaseTimeline.map((item) => (
                    <div key={item._id} className="text-xs bg-white border border-brand-100 p-2.5 rounded-xl">
                      <p className="text-brand-500 font-medium">
                        {new Date(item.createdAt).toLocaleString()} &bull; {item.userName} ({item.userRole.toUpperCase()})
                      </p>
                      <p className="mt-1 text-brand-900 font-semibold">{item.action.replace('_', ' ').toUpperCase()}</p>
                      <p className="mt-1 text-brand-700">{item.description}</p>
                    </div>
                  ))}
                </div>

                {/* Add note form */}
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    required
                    type="text"
                    placeholder="Add operational investigation note..."
                    value={investigationNoteInput}
                    onChange={(e) => setInvestigationNoteInput(e.target.value)}
                    className="field-input py-2 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={isAddingNote || !investigationNoteInput.trim()}
                    className="button-primary px-4 py-2 text-xs shrink-0 disabled:opacity-50"
                  >
                    {isAddingNote ? 'Saving...' : 'Add Note'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right: secure Chat Panel with reporter */}
            <div className="surface-panel p-4 flex flex-col h-[450px]">
              <div className="border-b border-brand-100 pb-2">
                <h4 className="font-bold text-brand-950 text-sm">Secure Communications Panel</h4>
                <p className="text-[10px] text-brand-500 uppercase">Victim Chat Stream</p>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto my-3 space-y-3 pr-1">
                {chatMessages.map((msg) => {
                  const isOwnMessage = msg.senderRole === user.role;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${isOwnMessage ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      <span className="text-[9px] text-brand-600 uppercase mb-0.5 px-1">
                        {msg.senderName} ({msg.senderRole.toUpperCase()})
                      </span>
                      <div
                        className={`rounded-2xl px-4 py-2 text-xs ${
                          isOwnMessage ? 'bg-brand-950 text-white rounded-tr-none' : 'bg-brand-50 border border-brand-100 text-brand-950 rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[8px] text-brand-500 mt-0.5 px-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  required
                  type="text"
                  placeholder="Type reply back to reporter..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="field-input py-2 text-xs"
                />
                <button
                  type="submit"
                  disabled={isSendingChat || !chatInput.trim()}
                  className="button-primary px-4 py-2 text-xs shrink-0 disabled:opacity-50"
                >
                  {isSendingChat ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
