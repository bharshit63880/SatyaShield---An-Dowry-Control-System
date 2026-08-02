import { useEffect, useState } from 'react';

import { useLanguage } from '../context/LanguageContext';
import { resendVerificationRequest, verifyEmailRequest } from '../services/api';

export function VerifyEmailPage() {
  const { t } = useLanguage();
  const [state, setState] = useState({
    status: 'loading',
    messageKey: 'visible.a3b02ec1a560'
  });
  const [email, setEmail] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    window.history.replaceState({}, document.title, window.location.pathname);
    if (!token) {
      setState({ status: 'error', messageKey: 'visible.04a88b4a6cde' });
      return;
    }
    verifyEmailRequest(token)
      .then(() => setState({ status: 'success', messageKey: 'emailVerification.success' }))
      .catch(() => setState({ status: 'error', messageKey: 'status.error' }));
  }, []);

  async function resend(event) {
    event.preventDefault();
    setState({ status: 'loading', messageKey: 'visible.30750ae47bec' });
    try {
      await resendVerificationRequest(email);
      setState({ status: 'success', messageKey: 'emailVerification.resent' });
    } catch {
      setState({ status: 'error', messageKey: 'status.error' });
    }
  }

  return <div className="page-shell py-12" style={{ maxWidth: 620 }}>
    <h1>{t('visible.4d225196c4e2')}</h1>
    <div
      className={state.status === 'error' ? 'alert-error' : 'alert-success'}
      role="status"
    >
      {t(state.messageKey)}
    </div>
    <form onSubmit={resend} style={{ display: 'flex', gap: 8, marginTop: 24 }}>
      <input
        required
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={t('visible.316ef5f98986')}
        style={{ flex: 1 }}
      />
      <button className="button-primary" disabled={state.status === 'loading'}>
        {t('visible.1f94843777ae')}
      </button>
    </form>
  </div>;
}
