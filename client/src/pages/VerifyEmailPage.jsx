import { useEffect, useState } from 'react';
import { resendVerificationRequest, verifyEmailRequest } from '../services/api';

export function VerifyEmailPage() {
  const [state, setState] = useState({ status: 'loading', message: 'Checking verification link…' });
  const [email, setEmail] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    window.history.replaceState({}, document.title, window.location.pathname);
    if (!token) {
      setState({ status: 'error', message: 'Verification link is missing or expired.' });
      return;
    }
    verifyEmailRequest(token)
      .then((result) => setState({ status: 'success', message: result.message }))
      .catch((error) => setState({ status: 'error', message: error.message }));
  }, []);

  async function resend(event) {
    event.preventDefault();
    setState({ status: 'loading', message: 'Requesting new instructions…' });
    try {
      const result = await resendVerificationRequest(email);
      setState({ status: 'success', message: result.message });
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  }

  return (
    <div className="page-shell py-12" style={{ maxWidth: 620 }}>
      <h1>Email verification</h1>
      <div className={state.status === 'error' ? 'alert-error' : 'alert-success'}>{state.message}</div>
      <form onSubmit={resend} style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Account email" style={{ flex: 1 }} />
        <button className="button-primary" disabled={state.status === 'loading'}>Resend</button>
      </form>
      <p>The response is the same whether or not an eligible account exists.</p>
    </div>
  );
}
