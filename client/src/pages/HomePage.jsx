import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const features = [
  ['visible.1809cd57957f', 'visible.9e0b9ff48bdf'],
  ['visible.3c024b485a48', 'visible.e56836a53b9c'],
  ['visible.79cc8e15a18f', 'visible.b050383efc1d'],
  ['visible.0475906b0a56', 'visible.8687b0a9411a'],
  ['visible.99570340b71f', 'visible.efb536aacf79'],
  ['visible.79c134f584dc', 'visible.31698f2748ba']
];
const safeguards = [
  ['home.assignment.verified', 'home.assignment.verifiedDetail'],
  ['home.assignment.minimized', 'home.assignment.minimizedDetail'],
  ['home.assignment.revocable', 'home.assignment.revocableDetail'],
  ['home.assignment.noGuarantee', 'home.assignment.noGuaranteeDetail']
];

export function HomePage() {
  const { t } = useLanguage();
  const [trackingId, setTrackingId] = useState('');
  const navigate = useNavigate();
  const handleSearch = event => {
    event.preventDefault();
    if (trackingId.trim()) navigate('/track', { state: { caseId: trackingId.trim() } });
  };
  return <div className="page-shell py-8 sm:py-12">
    <section className="animate-rise mb-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <h1 className="mb-6 text-5xl font-black leading-none tracking-tight text-white sm:text-7xl">
          {t('visible.c958d95cceef')}<br /><span className="gradient-text">{t('visible.efd1673a2484')}</span>
        </h1>
        <p className="mb-8 max-w-xl text-lg leading-8 text-white/60">{t('visible.cb022b6ed14e')}</p>
        <div className="mb-9 flex flex-wrap gap-3">
          <Link to="/report" className="button-primary">{t('visible.bcd6fbbe9e5a')}</Link>
          <Link to="/login" className="button-secondary">{t('visible.1d8cd68a36cb')}</Link>
        </div>
        <form onSubmit={handleSearch} className="cyber-card max-w-xl p-4">
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/60" htmlFor="home-case-id">{t('visible.2493df97fffc')}</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="home-case-id" required value={trackingId} onChange={event => setTrackingId(event.target.value)} placeholder={t('visible.4aed78621700')} className="field-input flex-1" />
            <button type="submit" className="button-primary">{t('visible.83374e805600')}</button>
          </div>
          <p className="mt-2 text-xs text-white/40">{t('visible.b5401cd6f4c2')}</p>
        </form>
      </div>
      <aside className="cyber-card p-6" aria-labelledby="assignment-safeguards-title">
        <p id="assignment-safeguards-title" className="eyebrow">{t('visible.99ea5f10e43b')}</p>
        <p className="mb-5 mt-2 text-sm text-white/60">{t('visible.21c1f1fe9ad3')}</p>
        <div className="space-y-3">
          {safeguards.map(([titleKey, detailKey]) => <div key={titleKey} className="rounded-xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between gap-3"><strong className="text-sm text-white">{t(titleKey)}</strong><span className="badge-active">{t('home.assignment.internalOnly')}</span></div>
            <p className="mt-2 text-xs leading-5 text-white/50">{t(detailKey)}</p>
          </div>)}
        </div>
      </aside>
    </section>
    <section className="mb-14" aria-labelledby="features-title">
      <div className="mb-8 text-center"><p className="eyebrow">{t('visible.41f583a94991')}</p><h2 id="features-title" className="mt-3 text-3xl font-extrabold text-white sm:text-5xl">{t('visible.5c0de5591855')}</h2><p className="mx-auto mt-4 max-w-xl text-white/50">{t('visible.9abcd981e4f9')}</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(([titleKey, detailKey]) => <article key={titleKey} className="cyber-card p-7"><h3 className="text-base font-bold text-white">{t(titleKey)}</h3><p className="mt-2 text-sm leading-6 text-white/50">{t(detailKey)}</p></article>)}</div>
    </section>
    <section className="cyber-card p-8 text-center sm:p-12"><p className="eyebrow">{t('visible.0d57cc1d6fc4')}</p><h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">{t('visible.b439618c941b')}</h2><p className="mx-auto mt-4 max-w-lg text-white/55">{t('visible.6acc0d33ef61')}</p><Link to="/report" className="button-primary mt-8 inline-flex">{t('visible.a336eadeea1a')}</Link><p className="mt-6 text-xs text-white/40">{t('visible.95112251616b')}</p></section>
  </div>;
}
