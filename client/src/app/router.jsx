import { createBrowserRouter } from 'react-router-dom';

import { ProtectedRoute } from '../components/ProtectedRoute';
import { DashboardRedirect } from '../components/DashboardRedirect';
import { RootLayout } from '../components/layout/RootLayout';
import { ComplaintPage } from '../pages/ComplaintPage';
import { DashboardPage } from '../pages/DashboardPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { CaseTrackingPage } from '../pages/CaseTrackingPage';
import { PrivacyPage } from '../pages/PrivacyPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { AccountSecurityPage } from '../pages/AccountSecurityPage';
import { NgoWorkspacePage } from '../pages/NgoWorkspacePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: 'login',
        element: <LoginPage />
      },
      {
        path: 'report',
        element: <ComplaintPage />
      },
      {
        path: 'privacy',
        element: <PrivacyPage />
      },
      {
        path: 'verify-email',
        element: <VerifyEmailPage />
      },
      {
        path: 'account/security',
        element: <ProtectedRoute><AccountSecurityPage /></ProtectedRoute>
      },
      {
        path: 'track',
        element: <CaseTrackingPage />
      },
      {
        path: 'track/:anonymousId',
        element: <CaseTrackingPage />
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <DashboardRedirect />
          </ProtectedRoute>
        )
      },
      {
        path: 'dashboard/admin',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
            <DashboardPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'dashboard/ngo',
        element: (
          <ProtectedRoute allowedRoles={['ngo']}>
            <NgoWorkspacePage />
          </ProtectedRoute>
        )
      },
      {
        path: 'dashboard/investigator',
        element: (
          <ProtectedRoute allowedRoles={['investigator']}>
            <DashboardPage />
          </ProtectedRoute>
        )
      },
      {
        path: '*',
        element: <NotFoundPage />
      }
    ]
  }
]);
