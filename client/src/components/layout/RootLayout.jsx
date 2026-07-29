import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { FloatingChatWidget } from '../chatbot/FloatingChatWidget';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { performQuickExit } from '../../services/quick-exit';

const publicNavigation = [
  { to: '/', labelKey: 'nav.home' },
  { to: '/report', labelKey: 'nav.report' }
];

export function RootLayout() {
  const { isAuthenticated, logout, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sensitiveReporterPage = location.pathname === '/report' ||
    location.pathname === '/track' || location.pathname.startsWith('/track/');
  const navigation = isAuthenticated
    ? [...publicNavigation, { to: '/dashboard', labelKey: 'nav.dashboard' }]
    : publicNavigation;

  useEffect(() => {
    document.title = sensitiveReporterPage ? 'SatyaShield — Secure page' : 'SatyaShield';
  }, [sensitiveReporterPage]);

  useEffect(() => {
    const onShortcut = (event) => {
      if (sensitiveReporterPage && event.altKey && event.key.toLowerCase() === 'q') {
        event.preventDefault();
        performQuickExit();
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [sensitiveReporterPage]);

  return (
    <div className="min-h-screen">
      <a className="skip-link" href="#main-content">{t('nav.skip')}</a>
      <header className="app-header">
        <div className="page-shell app-header-inner">
          <Link to="/" className="app-brand" aria-label={t('app.name')}>
            <span aria-hidden="true" className="app-brand-mark">S</span>
            <span><strong>{t('app.name')}</strong><small>{t('app.tagline')}</small></span>
          </Link>
          <nav className="desktop-navigation" aria-label="Primary">
            {navigation.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}>
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <label className="language-switcher">
              <span className="sr-only">{t('language.label')}</span>
              <select aria-label={t('language.label')} value={language}
                onChange={(event) => setLanguage(event.target.value)}>
                <option value="en">{t('language.english')}</option>
                <option value="hi">{t('language.hindi')}</option>
              </select>
            </label>
            {sensitiveReporterPage ? (
              <button type="button" className="quick-exit-button" onClick={performQuickExit}
                aria-keyshortcuts="Alt+Q" title={t('quickExit.hint')}>
                {t('quickExit.label')}
              </button>
            ) : null}
            {isAuthenticated && user ? <span className="session-indicator">{t('nav.session')}</span> : null}
            {isAuthenticated ? (
              <button type="button" onClick={logout} className="button-ghost">{t('nav.logout')}</button>
            ) : (
              <NavLink to="/login" className="button-primary">{t('nav.login')}</NavLink>
            )}
            <button type="button" className="mobile-menu-button"
              onClick={() => setMobileOpen((value) => !value)}
              aria-expanded={mobileOpen} aria-controls="mobile-navigation"
              aria-label={t(mobileOpen ? 'nav.menu.close' : 'nav.menu.open')}>
              <span aria-hidden="true">{mobileOpen ? '×' : '☰'}</span>
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <nav id="mobile-navigation" className="page-shell mobile-navigation" aria-label="Mobile">
            {navigation.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}>
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </header>
      <main id="main-content" tabIndex="-1" className="relative z-10 pb-20">
        <Outlet />
      </main>
      <footer className="app-footer">
        <div className="page-shell footer-inner">
          <strong>{t('app.name')} — {t('app.tagline')}</strong>
          <span>© 2026 SatyaShield. {t('footer.summary')} <Link to="/privacy">{t('footer.privacy')}</Link></span>
        </div>
      </footer>
      <FloatingChatWidget />
    </div>
  );
}
