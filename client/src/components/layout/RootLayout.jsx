import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { FloatingChatWidget } from '../chatbot/FloatingChatWidget';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { performQuickExit } from '../../services/quick-exit';
const publicNavigation = [{
  to: '/',
  labelKey: 'nav.home',
  icon: 'home'
}, {
  to: '/report',
  labelKey: 'nav.report',
  icon: 'report'
}];

function NavigationIcon({ name }) {
  if (name === 'report') {
    return <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3.75h7.6L19 8.15v12.1H7z" />
        <path d="M14.5 3.9v4.4h4.35M10 12h6M10 15.5h6" />
      </svg>;
  }

  if (name === 'dashboard') {
    return <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.75" y="3.75" width="6.5" height="6.5" rx="1.5" />
        <rect x="13.75" y="3.75" width="6.5" height="6.5" rx="1.5" />
        <rect x="3.75" y="13.75" width="6.5" height="6.5" rx="1.5" />
        <rect x="13.75" y="13.75" width="6.5" height="6.5" rx="1.5" />
      </svg>;
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.75 11.1 12 4l8.25 7.1v8.15H14.8V14h-5.6v5.25H3.75z" />
    </svg>;
}

export function RootLayout() {
  const {
    isAuthenticated,
    logout,
    user
  } = useAuth();
  const {
    language,
    setLanguage,
    t
  } = useLanguage();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sensitiveReporterPage = location.pathname === '/report' || location.pathname === '/track' || location.pathname.startsWith('/track/');
  const navigation = isAuthenticated ? [...publicNavigation, {
    to: '/dashboard',
    labelKey: 'nav.dashboard',
    icon: 'dashboard'
  }] : publicNavigation;
  useEffect(() => {
    document.title = sensitiveReporterPage ? 'SatyaShield — Secure page' : 'SatyaShield';
  }, [sensitiveReporterPage]);
  useEffect(() => {
    const onShortcut = event => {
      if (sensitiveReporterPage && event.altKey && event.key.toLowerCase() === 'q') {
        event.preventDefault();
        performQuickExit();
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [sensitiveReporterPage]);
  return <div className="min-h-screen">
      <a className="skip-link" href="#main-content">{t('nav.skip')}</a>
      <header className="app-header">
        <div className="page-shell app-header-inner">
          <Link to="/" className="app-brand" aria-label={t('app.name')}>
            <picture aria-hidden="true">
              <source media="(max-width: 520px)" srcSet="/favicon.png" />
              <img className="app-brand-logo" src="/satyashield-logo.png" alt="" />
            </picture>
          </Link>
          <nav className="desktop-navigation neumorphic-nav" aria-label={t("visible.efe10c80ec8a")}>
            {navigation.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({
            isActive
          }) => `nav-item ${isActive ? 'nav-active' : ''}`}>
                <span className="nav-icon"><NavigationIcon name={item.icon} /></span>
                <span className="nav-label">{t(item.labelKey)}</span>
              </NavLink>)}
          </nav>
          <div className="header-actions">
            <label className="language-switcher">
              <span className="sr-only">{t('language.label')}</span>
              <select aria-label={t('language.label')} value={language} onChange={event => setLanguage(event.target.value)}>
                <option value="en">{t('language.english')}</option>
                <option value="hi">{t('language.hindi')}</option>
              </select>
            </label>
            {sensitiveReporterPage ? <button type="button" className="quick-exit-button" onClick={performQuickExit} aria-keyshortcuts="Alt+Q" title={t('quickExit.hint')}>
                {t('quickExit.label')}
              </button> : null}
            {isAuthenticated && user ? <span className="session-indicator">{t('nav.session')}</span> : null}
            {isAuthenticated ? <button type="button" onClick={logout} className="button-ghost">{t('nav.logout')}</button> : <NavLink to="/login" className="button-primary">{t('nav.login')}</NavLink>}
            <button type="button" className="mobile-menu-button" onClick={() => setMobileOpen(value => !value)} aria-expanded={mobileOpen} aria-controls="mobile-navigation" aria-label={t(mobileOpen ? 'nav.menu.close' : 'nav.menu.open')}>
              <span aria-hidden="true">{mobileOpen ? '×' : '☰'}</span>
            </button>
          </div>
        </div>
        {mobileOpen ? <nav id="mobile-navigation" className="page-shell mobile-navigation" aria-label={t("visible.cbaad3cf4a65")}>
            {navigation.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileOpen(false)} className={({
          isActive
        }) => `nav-item ${isActive ? 'nav-active' : ''}`}>
                <span className="nav-icon"><NavigationIcon name={item.icon} /></span>
                <span className="nav-label">{t(item.labelKey)}</span>
              </NavLink>)}
          </nav> : null}
      </header>
      <main id="main-content" tabIndex="-1" className="relative z-10 pb-20">
        <Outlet />
      </main>
      <footer className="app-footer">
        <div className="page-shell footer-inner">
          <strong>{t('app.name')} — {t('app.tagline')}</strong>
          <span>{t("visible.a534dc68c2c0")}{t('footer.summary')} <Link to="/privacy">{t('footer.privacy')}</Link></span>
        </div>
      </footer>
      <FloatingChatWidget />
    </div>;
}
