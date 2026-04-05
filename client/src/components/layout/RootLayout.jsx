import { Link, NavLink, Outlet } from 'react-router-dom';

import { FloatingChatWidget } from '../chatbot/FloatingChatWidget';
import { useAuth } from '../../hooks/useAuth';

const navigation = [
  { to: '/', label: 'Home' },
  { to: '/report', label: 'Report' },
  { to: '/dashboard', label: 'Dashboard' }
];

export function RootLayout() {
  const { isAuthenticated, logout, user } = useAuth();

  return (
    <div className="min-h-screen bg-brand-50 text-brand-950">
      <div className="pointer-events-none fixed inset-0 bg-grid-fade bg-[size:52px_52px] opacity-40" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(61,150,239,0.14),transparent_55%)]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-[320px] bg-[radial-gradient(circle_at_bottom_left,rgba(24,170,162,0.1),transparent_55%)]" />

      <header className="sticky top-0 z-40">
        <div className="page-shell py-5">
          <div className="flex items-center justify-between gap-4 rounded-full border border-white/80 bg-white/80 px-4 py-3 shadow-[0_18px_50px_rgba(15,28,61,0.08)] backdrop-blur-xl sm:px-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-950 text-sm font-bold tracking-[0.22em] text-white">
                DC
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-brand-500">
                  Trust & Response
                </p>
                <p className="text-sm font-semibold text-brand-950 sm:text-base">Dahej Control</p>
              </div>
            </Link>

            <nav className="hidden items-center gap-2 rounded-full border border-brand-100 bg-brand-50/80 p-1.5 lg:flex">
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-950 text-white shadow-[0_10px_25px_rgba(15,28,61,0.22)]'
                        : 'text-brand-700 hover:bg-white hover:text-brand-950'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              {isAuthenticated && user ? (
                <div className="hidden rounded-full border border-accent-200 bg-accent-50 px-4 py-2 text-sm font-medium text-accent-700 md:block">
                  Admin session active
                </div>
              ) : null}

              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={logout}
                  className="button-secondary !px-4 !py-2.5"
                >
                  Sign out
                </button>
              ) : (
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    isActive ? 'button-primary !px-4 !py-2.5' : 'button-secondary !px-4 !py-2.5'
                  }
                >
                  Login
                </NavLink>
              )}
            </div>
          </div>

          <nav className="mt-3 flex items-center gap-2 overflow-x-auto rounded-full border border-white/80 bg-white/70 p-2 shadow-[0_12px_32px_rgba(15,28,61,0.06)] backdrop-blur lg:hidden">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-950 text-white'
                      : 'text-brand-700 hover:bg-brand-50 hover:text-brand-950'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative z-10 pb-16">
        <Outlet />
      </main>

      <FloatingChatWidget />
    </div>
  );
}
