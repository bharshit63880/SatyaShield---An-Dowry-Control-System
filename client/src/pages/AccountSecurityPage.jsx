import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  changePasswordRequest, enableMfaRequest, listSessionsRequest,
  logoutAllSessionsRequest, logoutOtherSessionsRequest, regenerateRecoveryCodesRequest,
  revokeSessionRequest, setupMfaRequest
} from '../services/api';

export function AccountSecurityPage() {
  const { token, logout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [message, setMessage] = useState('');
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [passwords, setPasswords] = useState({
    currentPassword: '', newPassword: '', code: '', recoveryCode: ''
  });

  async function loadSessions() {
    const response = await listSessionsRequest(token);
    setSessions(response.data.sessions);
  }
  useEffect(() => { loadSessions().catch((error) => setMessage(error.message)); }, [token]);

  async function beginMfa() {
    const response = await setupMfaRequest(token);
    setEnrollment(response.data);
  }
  async function confirmMfa() {
    const response = await enableMfaRequest(token, code);
    setRecoveryCodes(response.recoveryCodes || response.data?.recoveryCodes || []);
    setEnrollment(null);
    setMessage('MFA enabled. Recovery codes are shown once; store them safely.');
  }
  async function regenerate() {
    const response = await regenerateRecoveryCodesRequest(token, {
      currentPassword: passwords.currentPassword,
      code: passwords.code,
      recoveryCode: passwords.recoveryCode
    });
    setRecoveryCodes(response.data.recoveryCodes);
    setMessage('Previous recovery codes were invalidated.');
  }
  async function changePassword(event) {
    event.preventDefault();
    await changePasswordRequest(
      token, passwords.currentPassword, passwords.newPassword,
      passwords.code, passwords.recoveryCode
    );
    await logout();
  }

  return (
    <div className="page-shell py-12" style={{ maxWidth: 900 }}>
      <h1>Account security</h1>
      {message && <div className="alert-success">{message}</div>}
      <h2>Multi-factor authentication</h2>
      {!enrollment && <button className="button-primary" onClick={beginMfa}>Begin MFA enrollment</button>}
      {enrollment && <div>
        <p>Enter this secret in your authenticator. It is shown only during enrollment:</p>
        <code>{enrollment.manualSecret}</code>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" />
        <button className="button-primary" onClick={confirmMfa}>Confirm MFA</button>
      </div>}
      <button className="button-ghost" onClick={regenerate}>Regenerate recovery codes</button>
      {recoveryCodes.length > 0 && <div className="alert-warning">
        <strong>Save these single-use codes now:</strong>
        <pre>{recoveryCodes.join('\n')}</pre>
      </div>}

      <h2>Active sessions</h2>
      {sessions.map((session) => <div key={session.sessionId}>
        {session.label} · {new Date(session.createdAt).toLocaleString()} ·
        last used {new Date(session.lastUsedAt).toLocaleString()}
        {session.current ? ' · current' :
          <button onClick={async () => { await revokeSessionRequest(token, session.sessionId); await loadSessions(); }}>Revoke</button>}
      </div>)}
      <button onClick={async () => { await logoutOtherSessionsRequest(token); await loadSessions(); }}>Log out other sessions</button>
      <button onClick={async () => { await logoutAllSessionsRequest(token); await logout(); }}>Log out all sessions</button>

      <h2>Change password</h2>
      <form onSubmit={changePassword}>
        <input required type="password" placeholder="Current password"
          value={passwords.currentPassword}
          onChange={(e) => setPasswords((value) => ({ ...value, currentPassword: e.target.value }))} />
        <input required type="password" placeholder="New passphrase (12+ characters)"
          value={passwords.newPassword}
          onChange={(e) => setPasswords((value) => ({ ...value, newPassword: e.target.value }))} />
        <input value={passwords.code} placeholder="Current TOTP when MFA is enabled"
          onChange={(e) => setPasswords((value) => ({ ...value, code: e.target.value }))} />
        <input value={passwords.recoveryCode} placeholder="Or a recovery code"
          onChange={(e) => setPasswords((value) => ({ ...value, recoveryCode: e.target.value }))} />
        <button className="button-primary">Change password and sign out</button>
      </form>
    </div>
  );
}
