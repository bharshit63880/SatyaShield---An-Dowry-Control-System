import { Navigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

const ROLE_DASHBOARDS = {
  admin: '/dashboard/admin',
  superadmin: '/dashboard/admin',
  ngo: '/dashboard/ngo',
  investigator: '/dashboard/investigator'
};

export function DashboardRedirect() {
  const { user } = useAuth();
  return <Navigate to={ROLE_DASHBOARDS[user?.role] || '/'} replace />;
}
