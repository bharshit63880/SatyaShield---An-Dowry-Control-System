import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { FloatingChatWidget } from '../chatbot/FloatingChatWidget';
import { useAuth } from '../../hooks/useAuth';

const navigation = [
  { to: '/', label: 'Home', icon: '⬡' },
  { to: '/report', label: 'Report', icon: '◈' },
  { to: '/dashboard', label: 'Dashboard', icon: '◉' }
];

export function RootLayout() {
  const { isAuthenticated, logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: 'transparent', color: '#f0f4f8' }}>
      {/* Header */}
      <header className="sticky top-0 z-50">
        <div className="page-shell py-4">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            background: 'rgba(6, 11, 20, 0.85)',
            border: '1px solid rgba(0,229,204,0.15)',
            borderRadius: '100px',
            padding: '10px 16px 10px 12px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,229,204,0.05)'
          }}>
            {/* Logo */}
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              <div style={{
                width: '44px', height: '44px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(0,229,204,0.15) 0%, rgba(0,229,204,0.05) 100%)',
                border: '1px solid rgba(0,229,204,0.3)',
                borderRadius: '14px',
                fontSize: '18px',
                boxShadow: '0 0 15px rgba(0,229,204,0.15), inset 0 1px 0 rgba(255,255,255,0.1)'
              }}>
                🛡️
              </div>
              <div>
                <p style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#00e5cc', margin: 0 }}>
                  Anti-Dowry
                </p>
                <p style={{ fontSize: '15px', fontWeight: '800', color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
                  SatyaShield
                </p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex" style={{
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '100px',
              padding: '5px'
            }}>
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'nav-active' : ''}`
                  }
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    borderRadius: '100px',
                    fontSize: '13px',
                    fontWeight: '600',
                    letterSpacing: '0.01em',
                    transition: 'all 0.25s ease',
                    textDecoration: 'none',
                    background: isActive ? 'rgba(0,229,204,0.12)' : 'transparent',
                    color: isActive ? '#00e5cc' : 'rgba(255,255,255,0.55)',
                    border: isActive ? '1px solid rgba(0,229,204,0.3)' : '1px solid transparent',
                    boxShadow: isActive ? '0 0 12px rgba(0,229,204,0.15)' : 'none'
                  })}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Right actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              {isAuthenticated && user && (
                <div style={{
                  display: 'none',
                  padding: '6px 14px',
                  background: 'rgba(0,229,204,0.08)',
                  border: '1px solid rgba(0,229,204,0.2)',
                  borderRadius: '100px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#00e5cc'
                }} className="md:!flex items-center gap-2">
                  <span className="pulse-dot" style={{width:'6px',height:'6px'}}></span>
                  Session Active
                </div>
              )}

              {isAuthenticated ? (
                <button type="button" onClick={logout} className="button-ghost" style={{fontSize:'13px',padding:'8px 18px'}}>
                  Sign Out
                </button>
              ) : (
                <NavLink to="/login" className="button-primary" style={{fontSize:'13px',padding:'8px 20px'}}>
                  Operator Login
                </NavLink>
              )}

              {/* Mobile menu toggle */}
              <button
                type="button"
                className="lg:hidden"
                onClick={() => setMobileOpen(!mobileOpen)}
                style={{
                  width: '38px', height: '38px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontSize: '18px'
                }}
              >
                {mobileOpen ? '✕' : '☰'}
              </button>
            </div>
          </div>

          {/* Mobile nav */}
          {mobileOpen && (
            <div style={{
              marginTop: '8px',
              background: 'rgba(6,11,20,0.95)',
              border: '1px solid rgba(0,229,204,0.15)',
              borderRadius: '16px',
              padding: '8px',
              backdropFilter: 'blur(20px)',
              animation: 'rise 300ms ease-out'
            }}>
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    textDecoration: 'none',
                    color: isActive ? '#00e5cc' : 'rgba(255,255,255,0.6)',
                    background: isActive ? 'rgba(0,229,204,0.08)' : 'transparent',
                    marginBottom: '4px'
                  })}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 pb-20">
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(0,229,204,0.08)',
        padding: '32px 0',
        background: 'rgba(0,0,0,0.2)',
        position: 'relative',
        zIndex: 10
      }}>
        <div className="page-shell">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🛡️</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
                SATYASHIELD — ANTI-DOWRY PROTECTION PLATFORM
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', margin: 0 }}>
              © 2025 SatyaShield. All reports are anonymous & encrypted.
            </p>
          </div>
        </div>
      </footer>

      <FloatingChatWidget />
    </div>
  );
}
