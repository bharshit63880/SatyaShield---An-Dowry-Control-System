import { useLanguage } from "../context/LanguageContext";
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { changePasswordRequest, enableMfaRequest, listSessionsRequest, logoutAllSessionsRequest, logoutOtherSessionsRequest, regenerateRecoveryCodesRequest, revokeSessionRequest, setupMfaRequest } from '../services/api';
export function AccountSecurityPage() {
  const {
    t
  } = useLanguage();
  const {
    token,
    logout
  } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [message, setMessage] = useState('');
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    code: '',
    recoveryCode: ''
  });
  async function loadSessions() {
    const response = await listSessionsRequest(token);
    setSessions(response.data.sessions);
  }
  useEffect(() => {
    loadSessions().catch(() => setMessage(t('runtime.genericRequestFailed')));
  }, [token]);
  async function beginMfa() {
    const response = await setupMfaRequest(token);
    setEnrollment(response.data);
  }
  async function confirmMfa() {
    const response = await enableMfaRequest(token, code);
    setRecoveryCodes(response.recoveryCodes || response.data?.recoveryCodes || []);
    setEnrollment(null);
    setMessage(t('runtime.mfaEnabled'));
  }
  async function regenerate() {
    const response = await regenerateRecoveryCodesRequest(token, {
      currentPassword: passwords.currentPassword,
      code: passwords.code,
      recoveryCode: passwords.recoveryCode
    });
    setRecoveryCodes(response.data.recoveryCodes);
    setMessage(t('runtime.recoveryCodesReplaced'));
  }
  async function changePassword(event) {
    event.preventDefault();
    await changePasswordRequest(token, passwords.currentPassword, passwords.newPassword, passwords.code, passwords.recoveryCode);
    await logout();
  }
  return <div className="page-shell py-12" style={{
    maxWidth: 900
  }}>
      <h1>{t("visible.1d85c11e1444")}</h1>
      {message && <div className="alert-success">{message}</div>}
      <h2>{t("visible.0ed4c5fae196")}</h2>
      {!enrollment && <button className="button-primary" onClick={beginMfa}>{t("visible.86c0ab802db5")}</button>}
      {enrollment && <div>
        <p>{t("visible.b12fe534e5ed")}</p>
        <code>{enrollment.manualSecret}</code>
        <input value={code} onChange={e => setCode(e.target.value)} placeholder={t("visible.0d1fa0dfcc9e")} />
        <button className="button-primary" onClick={confirmMfa}>{t("visible.1f4ae5107144")}</button>
      </div>}
      <button className="button-ghost" onClick={regenerate}>{t("visible.49cc3d4c731f")}</button>
      {recoveryCodes.length > 0 && <div className="alert-warning">
        <strong>{t("visible.92b6cad3eb9e")}</strong>
        <pre>{recoveryCodes.join('\n')}</pre>
      </div>}

      <h2>{t("visible.61ad990902e7")}</h2>
      {sessions.map(session => <div key={session.sessionId}>
        {session.label} · {new Date(session.createdAt).toLocaleString()}{t("visible.612806ec03fa")}{new Date(session.lastUsedAt).toLocaleString()}
        {session.current ? ` · ${t('runtime.current')}` : <button onClick={async () => {
        await revokeSessionRequest(token, session.sessionId);
        await loadSessions();
      }}>{t("visible.87e6d00bbf53")}</button>}
      </div>)}
      <button onClick={async () => {
      await logoutOtherSessionsRequest(token);
      await loadSessions();
    }}>{t("visible.9039cecc8315")}</button>
      <button onClick={async () => {
      await logoutAllSessionsRequest(token);
      await logout();
    }}>{t("visible.471a635c5122")}</button>

      <h2>{t("visible.3f9c991f63a9")}</h2>
      <form onSubmit={changePassword}>
        <input required type="password" placeholder={t("visible.72ed2bd767ce")} value={passwords.currentPassword} onChange={e => setPasswords(value => ({
        ...value,
        currentPassword: e.target.value
      }))} />
        <input required type="password" placeholder={t("visible.61a44388b8bb")} value={passwords.newPassword} onChange={e => setPasswords(value => ({
        ...value,
        newPassword: e.target.value
      }))} />
        <input value={passwords.code} placeholder={t("visible.2f831e1a7228")} onChange={e => setPasswords(value => ({
        ...value,
        code: e.target.value
      }))} />
        <input value={passwords.recoveryCode} placeholder={t("visible.936a33d0a381")} onChange={e => setPasswords(value => ({
        ...value,
        recoveryCode: e.target.value
      }))} />
        <button className="button-primary">{t("visible.c7cafb4af09a")}</button>
      </form>
    </div>;
}
