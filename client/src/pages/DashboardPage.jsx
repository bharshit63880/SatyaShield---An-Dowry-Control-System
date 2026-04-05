import { startTransition, useDeferredValue, useEffect, useState } from 'react';

import { AnalyticsPanels } from '../components/dashboard/AnalyticsPanels';
import { ComplaintList } from '../components/dashboard/ComplaintList';
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar';
import { HeatmapPanel } from '../components/dashboard/HeatmapPanel';
import { NotificationPanel } from '../components/dashboard/NotificationPanel';
import { InfoCard } from '../components/ui/InfoCard';
import { useAuth } from '../hooks/useAuth';
import {
  getDashboardComplaints,
  getDashboardSummary,
  updateDashboardComplaintStatusRequest
} from '../services/api';

const initialSummary = {
  appName: 'Dahej Control System',
  totalUsers: 0,
  adminUsers: 0,
  totalComplaints: 0,
  totalNgoAssigned: 0,
  complaintStatusSummary: {
    submitted: 0,
    'under-review': 0,
    resolved: 0,
    rejected: 0
  },
  complaintRiskSummary: {
    low: 0,
    medium: 0,
    high: 0
  },
  complaintTrend: [],
  complaintHeatmap: [],
  unreadNotifications: 0,
  recentNotifications: [],
  currentAdmin: {
    role: 'admin'
  },
  generatedAt: null
};

export function DashboardPage() {
  const { token } = useAuth();
  const [summary, setSummary] = useState(initialSummary);
  const [complaints, setComplaints] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isComplaintsLoading, setIsComplaintsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [updatingComplaintId, setUpdatingComplaintId] = useState('');
  const deferredStatus = useDeferredValue(selectedStatus);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      try {
        const response = await getDashboardSummary(token);

        if (isMounted) {
          setSummary(response.data);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message);
        }
      } finally {
        if (isMounted) {
          setIsSummaryLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    let isMounted = true;

    async function loadComplaints() {
      setIsComplaintsLoading(true);

      try {
        const response = await getDashboardComplaints(token, deferredStatus);

        if (isMounted) {
          setComplaints(response.data.complaints);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message);
        }
      } finally {
        if (isMounted) {
          setIsComplaintsLoading(false);
        }
      }
    }

    loadComplaints();

    return () => {
      isMounted = false;
    };
  }, [deferredStatus, token]);

  function handleFilterChange(status) {
    setErrorMessage('');
    startTransition(() => {
      setSelectedStatus(status);
    });
  }

  async function refreshSummary() {
    const response = await getDashboardSummary(token);
    setSummary(response.data);
  }

  async function refreshComplaints(nextStatus = deferredStatus) {
    const response = await getDashboardComplaints(token, nextStatus);
    setComplaints(response.data.complaints);
  }

  async function handleStatusUpdate(anonymousId, status) {
    setErrorMessage('');
    setUpdatingComplaintId(anonymousId);

    try {
      await updateDashboardComplaintStatusRequest(token, anonymousId, status);
      await Promise.all([refreshSummary(), refreshComplaints()]);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setUpdatingComplaintId('');
    }
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-28 xl:self-start">
          <DashboardSidebar statusSummary={summary.complaintStatusSummary} />
        </div>

        <div className="space-y-6">
          <section className="surface-panel overflow-hidden p-6 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <p className="eyebrow">Premium operations workspace</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-brand-950 sm:text-5xl">
                  Monitor complaints, analytics, routing, and alerts from one trust-first command center.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-600 sm:text-base">
                  The dashboard combines product-grade clarity with sensitive-case operations:
                  triage, evidence access, NGO assignment, location heatmaps, and alerting are all
                  visible in one responsive workspace.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-brand-100 bg-white px-5 py-5 shadow-[0_14px_40px_rgba(15,28,61,0.05)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-500">
                    Session
                  </p>
                  <p className="mt-2 text-lg font-semibold capitalize text-brand-950">
                    {summary.currentAdmin.role} access active
                  </p>
                  <p className="mt-1 text-sm text-brand-600">
                    {summary.generatedAt
                      ? `Last refresh ${new Date(summary.generatedAt).toLocaleString()}`
                      : 'Waiting for dashboard data'}
                  </p>
                </div>

                <div className="rounded-[24px] border border-accent-200 bg-accent-50 px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-700">
                    Product posture
                  </p>
                  <p className="mt-2 text-lg font-semibold text-brand-950">
                    Privacy-first, response-ready
                  </p>
                  <p className="mt-1 text-sm text-brand-600">
                    Designed to feel operationally credible on every screen size.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {errorMessage ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InfoCard
              label="Complaints"
              value={summary.totalComplaints}
              hint="All anonymous complaints in MongoDB"
            />
            <InfoCard
              label="Submitted"
              value={summary.complaintStatusSummary.submitted}
              hint="Cases waiting for triage"
            />
            <InfoCard
              label="High Risk"
              value={summary.complaintRiskSummary.high}
              hint="Urgent complaints with stronger dowry-risk signals"
            />
            <InfoCard
              label="NGO Routed"
              value={summary.totalNgoAssigned}
              hint="Complaints routed to an NGO match"
            />
            <InfoCard
              label="Unread Alerts"
              value={summary.unreadNotifications}
              hint="In-app notifications for admins"
            />
            <InfoCard
              label="Admin Users"
              value={summary.adminUsers}
              hint="Authorized operators in the system"
            />
          </section>

          <AnalyticsPanels
            trend={summary.complaintTrend}
            statusSummary={summary.complaintStatusSummary}
            riskSummary={summary.complaintRiskSummary}
          />

          <HeatmapPanel locations={summary.complaintHeatmap} />

          <section className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <ComplaintList
                complaints={complaints}
                filter={selectedStatus}
                isLoading={isComplaintsLoading}
                onFilterChange={handleFilterChange}
                onStatusUpdate={handleStatusUpdate}
                updatingId={updatingComplaintId}
              />

              <aside className="surface-card p-6">
                <p className="eyebrow">Queue Health</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-brand-950">
                  Workflow status
                </h2>
                <p className="mt-3 text-sm leading-6 text-brand-600">
                  Use these totals to keep the triage queue moving and spot bottlenecks quickly.
                </p>

                {isSummaryLoading ? (
                  <div className="mt-6 rounded-[24px] border border-brand-100 bg-brand-50 px-5 py-4 text-sm text-brand-700">
                    Loading status overview...
                  </div>
                ) : (
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[
                      ['Under Review', summary.complaintStatusSummary['under-review']],
                      ['High Risk', summary.complaintRiskSummary.high],
                      ['Medium Risk', summary.complaintRiskSummary.medium],
                      ['Rejected', summary.complaintStatusSummary.rejected],
                      ['System Users', summary.totalUsers]
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-[22px] border border-brand-100 bg-brand-50 px-4 py-4 text-sm text-brand-700"
                      >
                        <p>{label}</p>
                        <p className="mt-2 text-2xl font-semibold text-brand-950">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </aside>
            </div>

            <NotificationPanel
              notifications={summary.recentNotifications}
              unreadCount={summary.unreadNotifications}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
