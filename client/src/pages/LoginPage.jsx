import { startTransition, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { forgotPasswordRequest, resetPasswordRequest, registerNgoRequest } from '../services/api';

const securityFeatures = [
  { icon: '🔐', text: 'Multi-Factor Authentication (TOTP/OTP)' },
  { icon: '📡', text: 'Audited Session Tracking & IP Verification' },
  { icon: '🔒', text: 'Encrypted Chat & Evidence Vault Access' },
  { icon: '🛡️', text: 'Hardware-Bound Security Keys' }
];

export function LoginPage() {
  const { isAuthenticated, login, loginMfa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState('login');
  const [formState, setFormState] = useState({ email: '', password: '' });
  const [mfaData, setMfaData] = useState({ userId: '', mfaToken: '', code: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetData, setResetData] = useState({ token: '', newPassword: '' });
  const [ngoData, setNgoData] = useState({
    name: '', email: '', password: '', phone: '', city: '', district: '', description: ''
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const destination = location.state?.from ?? '/dashboard';

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  function handleChange(setter) {
    return (e) => {
      const { name, value } = e.target;
      setter((s) => ({ ...s, [name]: value }));
    };
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const result = await login(formState);
      if (result?.mfaRequired) {
        setMfaData({ userId: result.userId, mfaToken: result.mfaToken, code: '' });
        setMode('mfa');
      } else {
        startTransition(() => navigate(destination, { replace: true }));
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMfaSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await loginMfa({ userId: mfaData.userId, mfaToken: mfaData.mfaToken, code: mfaData.code });
      startTransition(() => navigate(destination, { replace: true }));
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await forgotPasswordRequest(forgotEmail);
      setSuccessMessage(res.message || 'Reset link sent to console.');
      setMode('reset');
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await resetPasswordRequest(resetData.token, resetData.newPassword);
      setSuccessMessage(res.message || 'Password reset. You can log in now.');
      setMode('login');
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleNgoSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await registerNgoRequest(ngoData);
      setSuccessMessage(res.message || 'NGO registration submitted for review.');
      setMode('login');
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldStyle = {
    width: '100%',
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '12px 16px',
    fontSize: '14px',
    color: '#f0f4f8',
    outline: 'none',
    transition: 'all 0.25s ease',
    fontFamily: 'inherit'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: '6px'
  };

  return (
    <div className="page-shell py-8 sm:py-12 animate-rise">
      <div
        className="grid grid-cols-1 lg:grid-cols-2"
        style={{
          minHeight: '80vh',
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '24px',
          overflow: 'hidden'
        }}
      >

        {/* ── Left Panel — Brand / Security ── */}
        <div style={{
          background: 'linear-gradient(135deg, #060b14 0%, #0d1420 60%, #060b14 100%)',
          borderRight: '1px solid rgba(0,229,204,0.12)',
          padding: '48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Background circuit lines */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.3,
            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(0,229,204,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(124,58,237,0.08) 0%, transparent 50%)'
          }} />

          <div style={{ position: 'relative' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
              <div style={{
                width: '52px', height: '52px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,229,204,0.1)',
                border: '1px solid rgba(0,229,204,0.3)',
                borderRadius: '16px',
                fontSize: '24px',
                boxShadow: '0 0 20px rgba(0,229,204,0.15)'
              }}>
                🛡️
              </div>
              <div>
                <p style={{ fontSize: '9px', fontWeight: '700', color: '#00e5cc', letterSpacing: '0.3em', textTransform: 'uppercase', margin: '0 0 2px' }}>
                  Protected Entrance
                </p>
                <p style={{ fontSize: '20px', fontWeight: '800', color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
                  SatyaShield Core
                </p>
              </div>
            </div>

            <p className="eyebrow" style={{ marginBottom: '12px' }}>Operations Center</p>
            <h2 style={{
              fontSize: 'clamp(28px, 3vw, 42px)',
              fontWeight: '800',
              color: '#fff',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              marginBottom: '16px'
            }}>
              Secure Access for<br />
              <span style={{
                background: 'linear-gradient(135deg, #00e5cc, #7c3aed)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Authorized Personnel
              </span>
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.7', marginBottom: '32px', maxWidth: '380px' }}>
              Authorized access for NGOs, Investigators, Operators, and Administrators. MFA tokens required for all platform interventions.
            </p>

            {/* Security Features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {securityFeatures.map((f) => (
                <div key={f.text} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  padding: '12px 16px'
                }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>{f.icon}</span>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', fontWeight: '500' }}>{f.text}</span>
                  <span style={{ marginLeft: 'auto', color: '#00e5cc', fontSize: '14px' }}>✓</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom warning */}
          <div style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginTop: '32px',
            position: 'relative'
          }}>
            <p style={{ fontSize: '11px', color: 'rgba(239,100,100,0.8)', lineHeight: '1.5', margin: 0 }}>
              ⚠️ SatyaShield is locked by hardware-bound security keys. Unauthorized login attempts trigger security protocols and log client signatures in the global audit vault.
            </p>
          </div>
        </div>

        {/* ── Right Panel — Forms ── */}
        <div style={{
          background: 'rgba(13,20,32,0.95)',
          padding: '48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          {/* Alerts */}
          {errorMessage && (
            <div className="alert-error" style={{ marginBottom: '20px' }}>
              ⚠️ {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="alert-success" style={{ marginBottom: '20px' }}>
              ✅ {successMessage}
            </div>
          )}

          {/* ─── Login Mode ─── */}
          {mode === 'login' && (
            <div>
              <p className="eyebrow" style={{ marginBottom: '8px' }}>Workspace Entrance</p>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#fff', letterSpacing: '-0.03em', marginBottom: '6px' }}>
                Welcome Back
              </h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '32px' }}>
                Enter your credentials to authenticate.
              </p>

              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input
                    required type="email" name="email"
                    value={formState.email}
                    onChange={handleChange(setFormState)}
                    style={fieldStyle}
                    placeholder="operator@satyashield.gov.in"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input
                    required type="password" name="password"
                    value={formState.password}
                    onChange={handleChange(setFormState)}
                    style={fieldStyle}
                    placeholder="••••••••••••"
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button type="button" onClick={() => setMode('forgot')}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
                    Forgot password?
                  </button>
                  <button type="button" onClick={() => setMode('register_ngo')}
                    style={{ background: 'none', border: 'none', color: '#00e5cc', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: 0 }}>
                    NGO Registration →
                  </button>
                </div>

                <button type="submit" disabled={isSubmitting} className="button-primary"
                  style={{ width: '100%', marginTop: '8px', padding: '14px' }}>
                  {isSubmitting ? '⏳ Verifying credentials...' : '🔓 Enter Dashboard'}
                </button>
              </form>
            </div>
          )}

          {/* ─── MFA Mode ─── */}
          {mode === 'mfa' && (
            <div>
              <p className="eyebrow" style={{ marginBottom: '8px' }}>Identity Verification</p>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#fff', letterSpacing: '-0.03em', marginBottom: '6px' }}>
                Enter MFA Code
              </h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '32px' }}>
                Open your Authenticator app and enter the 6-digit code.
              </p>

              <form onSubmit={handleMfaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Authenticator Code</label>
                  <input
                    required type="text" name="code"
                    value={mfaData.code}
                    onChange={handleChange(setMfaData)}
                    maxLength="6" pattern="\d{6}"
                    style={{ ...fieldStyle, textAlign: 'center', fontSize: '28px', letterSpacing: '0.5em', fontFamily: 'JetBrains Mono, monospace', fontWeight: '600' }}
                    placeholder="000000"
                  />
                </div>
                <button type="submit" disabled={isSubmitting} className="button-primary" style={{ width: '100%', padding: '14px' }}>
                  {isSubmitting ? '⏳ Verifying...' : '✅ Confirm Sign In'}
                </button>
                <button type="button" onClick={() => setMode('login')} className="button-ghost" style={{ width: '100%' }}>
                  ← Back to Login
                </button>
              </form>
            </div>
          )}

          {/* ─── Forgot Password ─── */}
          {mode === 'forgot' && (
            <div>
              <p className="eyebrow" style={{ marginBottom: '8px' }}>Password Recovery</p>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#fff', letterSpacing: '-0.03em', marginBottom: '6px' }}>
                Request Reset Token
              </h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '32px' }}>
                Enter your email to receive a password reset security token.
              </p>

              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input
                    required type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    style={fieldStyle}
                    placeholder="operator@satyashield.gov.in"
                  />
                </div>
                <button type="submit" disabled={isSubmitting} className="button-primary" style={{ width: '100%', padding: '14px' }}>
                  {isSubmitting ? '⏳ Requesting...' : '📧 Send Recovery Token'}
                </button>
                <button type="button" onClick={() => setMode('login')} className="button-ghost" style={{ width: '100%' }}>
                  ← Back to Login
                </button>
              </form>
            </div>
          )}

          {/* ─── Reset Password ─── */}
          {mode === 'reset' && (
            <div>
              <p className="eyebrow" style={{ marginBottom: '8px' }}>Security Reset</p>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#fff', letterSpacing: '-0.03em', marginBottom: '6px' }}>
                Reset Password
              </h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '32px' }}>
                Enter the recovery token and your new password.
              </p>

              <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Reset Token</label>
                  <input
                    required type="text" name="token"
                    value={resetData.token}
                    onChange={handleChange(setResetData)}
                    style={fieldStyle}
                    placeholder="Paste reset token here"
                  />
                </div>
                <div>
                  <label style={labelStyle}>New Password</label>
                  <input
                    required type="password" name="newPassword"
                    value={resetData.newPassword}
                    onChange={handleChange(setResetData)}
                    style={fieldStyle}
                    placeholder="Min. 8 characters"
                  />
                </div>
                <button type="submit" disabled={isSubmitting} className="button-primary" style={{ width: '100%', padding: '14px' }}>
                  {isSubmitting ? '⏳ Resetting...' : '🔑 Change Password'}
                </button>
                <button type="button" onClick={() => setMode('login')} className="button-ghost" style={{ width: '100%' }}>
                  Cancel
                </button>
              </form>
            </div>
          )}

          {/* ─── NGO Registration ─── */}
          {mode === 'register_ngo' && (
            <div>
              <p className="eyebrow" style={{ marginBottom: '8px' }}>Partner Onboarding</p>
              <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#fff', letterSpacing: '-0.03em', marginBottom: '6px' }}>
                Register NGO
              </h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '24px' }}>
                Join our responder directory. All applications require background clearance.
              </p>

              <form onSubmit={handleNgoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                <div>
                  <label style={labelStyle}>NGO Name</label>
                  <input required type="text" name="name" value={ngoData.name}
                    onChange={handleChange(setNgoData)} style={fieldStyle}
                    placeholder="e.g. Mahila Mukti Foundation" />
                </div>
                <div>
                  <label style={labelStyle}>Official Email</label>
                  <input required type="email" name="email" value={ngoData.email}
                    onChange={handleChange(setNgoData)} style={fieldStyle}
                    placeholder="contact@ngo.org" />
                </div>
                <div>
                  <label style={labelStyle}>Portal Password</label>
                  <input required type="password" name="password" value={ngoData.password}
                    onChange={handleChange(setNgoData)} style={fieldStyle}
                    placeholder="Minimum 8 characters" />
                </div>
                <div>
                  <label style={labelStyle}>Contact Number</label>
                  <input required type="text" name="phone" value={ngoData.phone}
                    onChange={handleChange(setNgoData)} style={fieldStyle}
                    placeholder="+91-XXXXXXXXXX" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>HQ City</label>
                    <input required type="text" name="city" value={ngoData.city}
                      onChange={handleChange(setNgoData)} style={fieldStyle} placeholder="City" />
                  </div>
                  <div>
                    <label style={labelStyle}>HQ District</label>
                    <input required type="text" name="district" value={ngoData.district}
                      onChange={handleChange(setNgoData)} style={fieldStyle} placeholder="District" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Description & Mission</label>
                  <textarea name="description" value={ngoData.description}
                    onChange={handleChange(setNgoData)} rows="3"
                    style={{ ...fieldStyle, resize: 'vertical', minHeight: '80px' }}
                    placeholder="Describe coverage areas and focus areas..." />
                </div>
                <button type="submit" disabled={isSubmitting} className="button-primary" style={{ width: '100%', padding: '14px', marginTop: '4px' }}>
                  {isSubmitting ? '⏳ Registering...' : '🤝 Submit NGO Application'}
                </button>
                <button type="button" onClick={() => setMode('login')} className="button-ghost" style={{ width: '100%' }}>
                  Cancel
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
