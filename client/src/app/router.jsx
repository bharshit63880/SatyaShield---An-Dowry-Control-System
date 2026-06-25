import { createBrowserRouter } from 'react-router-dom';

import { ProtectedRoute } from '../components/ProtectedRoute';
import { RootLayout } from '../components/layout/RootLayout';
import { ComplaintPage } from '../pages/ComplaintPage';
import { DashboardPage } from '../pages/DashboardPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { CaseTrackingPage } from '../pages/CaseTrackingPage';

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
        path: 'track/:anonymousId',
        element: <CaseTrackingPage />
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
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
