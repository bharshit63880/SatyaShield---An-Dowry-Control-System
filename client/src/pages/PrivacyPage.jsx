import { AI_DISCLOSURE_VERSION, PRIVACY_NOTICE_VERSION } from '../config/privacy';
import { useLanguage } from '../context/LanguageContext';

export function PrivacyPage() {
  const { t } = useLanguage();
  return (
    <div className="page-shell py-12" style={{ maxWidth: 880 }}>
      <p className="eyebrow">Privacy notice</p>
      <h1>What SatyaShield collects and why</h1>
      <p>This plain-language notice is structured for future Hindi translation. It is product guidance, not a substitute for legal review.</p>
      <h2>Anonymous reports</h2>
      <p>We do not ask for your name, email, phone number, exact address, or GPS location. Your description, optional city or district, case access credential hash, workflow data, and optional evidence are stored to operate the case.</p>
      <h2>Evidence and access</h2>
      <p>Accepted evidence is encrypted in private storage. Authorized staff may view it for case work. Keep the one-time access secret safe; the service stores only a keyed hash and cannot display it again.</p>
      <h2>Operational records</h2>
      <p>Security logs use route templates and coarse timing. Audit records store purpose-limited events and hashed resource references; they do not intentionally store raw IP addresses, browser strings, report text, or credentials.</p>
      <h2>Optional AI processing</h2>
      <p>AI processing is off by default. If both the service operator enables it and you opt in, up to 2,000 characters of the complaint description may be sent to the configured AI provider for risk triage. Local rules are used otherwise or if the provider fails.</p>
      <h2>Retention and deletion</h2>
      <p>Records carry retention eligibility and legal-hold metadata. Phase 4 only reports records eligible under the configured policy; automatic deletion is not enabled.</p>
      <h2>Important limits</h2>
      <p>Do not use SatyaShield as an emergency service. Network and hosting providers may process ordinary connection metadata outside the application. No delivery or response time is guaranteed.</p>
      <p>{t('privacy.help')}</p>
      <p>Privacy notice: {PRIVACY_NOTICE_VERSION}. AI disclosure: {AI_DISCLOSURE_VERSION}. Contact channel: not yet configured.</p>
    </div>
  );
}
