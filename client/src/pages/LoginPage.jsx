import { useLanguage } from "../context/LanguageContext";
import { startTransition, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { forgotPasswordRequest, resetPasswordRequest, registerNgoRequest } from '../services/api';
const securityFeatures = [{
  icon: '🔐',
  textKey: 'visible.8fe1b41f18e7'
}, {
  icon: '📡',
  textKey: 'visible.bb9a20799abc'
}, {
  icon: '🔒',
  textKey: 'visible.e4c2a01fc06c'
}, {
  icon: '🛡️',
  textKey: 'visible.f6845061a53c'
}];
export function LoginPage() {
  const {
    t
  } = useLanguage();
  const {
    isAuthenticated,
    login,
    loginMfa
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [formState, setFormState] = useState({
    email: '',
    password: ''
  });
  const [mfaData, setMfaData] = useState({
    challengeToken: '',
    code: '',
    recoveryCode: ''
  });
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetData, setResetData] = useState({
    token: '',
    newPassword: ''
  });
  const [ngoData, setNgoData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    district: '',
    description: ''
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const destination = location.state?.from ?? '/dashboard';
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('resetToken');
    if (resetToken) {
      setResetData(value => ({
        ...value,
        token: resetToken
      }));
      setMode('reset');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  function handleChange(setter) {
    return e => {
      const {
        name,
        value
      } = e.target;
      setter(s => ({
        ...s,
        [name]: value
      }));
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
        setMfaData({
          challengeToken: result.challengeToken,
          code: '',
          recoveryCode: ''
        });
        setMode('mfa');
      } else {
        startTransition(() => navigate(destination, {
          replace: true
        }));
      }
    } catch (err) {
      setErrorMessage(t('runtime.loginFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }
  async function handleMfaSubmit(e) {
    e.preventDefault();
    if (!mfaData.code.trim() && !mfaData.recoveryCode.trim()) {
      setErrorMessage(t('runtime.mfaCodeRequired'));
      return;
    }
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await loginMfa({
        challengeToken: mfaData.challengeToken,
        ...(mfaData.recoveryCode ? {
          recoveryCode: mfaData.recoveryCode
        } : {
          code: mfaData.code
        })
      });
      startTransition(() => navigate(destination, {
        replace: true
      }));
    } catch (err) {
      setErrorMessage(t('runtime.loginFailed'));
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
      await forgotPasswordRequest(forgotEmail);
      setSuccessMessage(t('runtime.resetQueued'));
    } catch {
      setErrorMessage(t('runtime.genericRequestFailed'));
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
      await resetPasswordRequest(resetData.token, resetData.newPassword);
      setSuccessMessage(t('runtime.passwordReset'));
      setMode('login');
    } catch {
      setErrorMessage(t('runtime.genericRequestFailed'));
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
      await registerNgoRequest(ngoData);
      setSuccessMessage(t('runtime.ngoRegistered'));
      setMode('login');
    } catch {
      setErrorMessage(t('runtime.genericRequestFailed'));
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
  return <div className="page-shell py-8 sm:py-12 animate-rise">
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{
      minHeight: '80vh',
      background: 'rgba(0,0,0,0.2)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '24px',
      overflow: 'hidden'
    }}>

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
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.3,
          backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(0,229,204,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(124,58,237,0.08) 0%, transparent 50%)'
        }} />

          <div style={{
          position: 'relative'
        }}>
            {/* Logo */}
            <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '40px'
          }}>
              <div style={{
              width: '52px',
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,229,204,0.1)',
              border: '1px solid rgba(0,229,204,0.3)',
              borderRadius: '16px',
              fontSize: '24px',
              boxShadow: '0 0 20px rgba(0,229,204,0.15)'
            }}>
                🛡️
              </div>
              <div>
                <p style={{
                fontSize: '9px',
                fontWeight: '700',
                color: '#00e5cc',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                margin: '0 0 2px'
              }}>{t("visible.360b0d73a8de")}</p>
                <p style={{
                fontSize: '20px',
                fontWeight: '800',
                color: '#fff',
                margin: 0,
                letterSpacing: '-0.02em'
              }}>{t("visible.a80a3a85562c")}</p>
              </div>
            </div>

            <p className="eyebrow" style={{
            marginBottom: '12px'
          }}>{t("visible.ec35c69829f9")}</p>
            <h2 style={{
            fontSize: 'clamp(28px, 3vw, 42px)',
            fontWeight: '800',
            color: '#fff',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            marginBottom: '16px'
          }}>{t("visible.7cc5bc160511")}<br />
              <span style={{
              background: 'linear-gradient(135deg, #00e5cc, #7c3aed)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>{t("visible.078abfa64ea1")}</span>
            </h2>
            <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.45)',
            lineHeight: '1.7',
            marginBottom: '32px',
            maxWidth: '380px'
          }}>{t("visible.3273dc95915e")}</p>

            {/* Security Features */}
            <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
              {securityFeatures.map(f => <div key={f.textKey} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '12px 16px'
            }}>
                  <span style={{
                fontSize: '18px',
                flexShrink: 0
              }}>{f.icon}</span>
                  <span style={{
                fontSize: '13px',
                color: 'rgba(255,255,255,0.65)',
                fontWeight: '500'
                  }}>{t(f.textKey)}</span>
                  <span style={{
                marginLeft: 'auto',
                color: '#00e5cc',
                fontSize: '14px'
              }}>✓</span>
                </div>)}
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
            <p style={{
            fontSize: '11px',
            color: 'rgba(239,100,100,0.8)',
            lineHeight: '1.5',
            margin: 0
          }}>{t("visible.51b1b713fdc4")}</p>
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
          {errorMessage && <div className="alert-error" style={{
          marginBottom: '20px'
        }}>
              ⚠️ {errorMessage}
            </div>}
          {successMessage && <div className="alert-success" style={{
          marginBottom: '20px'
        }}>
              ✅ {successMessage}
            </div>}

          {/* ─── Login Mode ─── */}
          {mode === 'login' && <div>
              <p className="eyebrow" style={{
            marginBottom: '8px'
          }}>{t("visible.d82ae63bd46c")}</p>
              <h2 style={{
            fontSize: '32px',
            fontWeight: '800',
            color: '#fff',
            letterSpacing: '-0.03em',
            marginBottom: '6px'
          }}>{t("visible.0c3310a647b0")}</h2>
              <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '32px'
          }}>{t("visible.ed8d94432143")}</p>

              <form onSubmit={handleLoginSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
                <div>
                  <label style={labelStyle}>{t("visible.09bf25ef3083")}</label>
                  <input required type="email" name="email" value={formState.email} onChange={handleChange(setFormState)} style={fieldStyle} placeholder={t("visible.cff71654db99")} />
                </div>
                <div>
                  <label style={labelStyle}>{t("visible.e7cf3ef4f17c")}</label>
                  <input required type="password" name="password" value={formState.password} onChange={handleChange(setFormState)} style={fieldStyle} placeholder="••••••••••••" />
                </div>

                <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
                  <button type="button" onClick={() => setMode('forgot')} style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '13px',
                cursor: 'pointer',
                padding: 0
              }}>{t("visible.30c1d8d3e912")}</button>
                  <button type="button" onClick={() => setMode('register_ngo')} style={{
                background: 'none',
                border: 'none',
                color: '#00e5cc',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0
              }}>{t("visible.1ae30b58fb5d")}</button>
                </div>

                <button type="submit" disabled={isSubmitting} className="button-primary" style={{
              width: '100%',
              marginTop: '8px',
              padding: '14px'
            }}>
                  {isSubmitting ? t('runtime.verifyingCredentials') : t('runtime.enterDashboard')}
                </button>
              </form>
            </div>}

          {/* ─── MFA Mode ─── */}
          {mode === 'mfa' && <div>
              <p className="eyebrow" style={{
            marginBottom: '8px'
          }}>{t("visible.11c4c9beeb1d")}</p>
              <h2 style={{
            fontSize: '32px',
            fontWeight: '800',
            color: '#fff',
            letterSpacing: '-0.03em',
            marginBottom: '6px'
          }}>{t("visible.1e8e501abfc4")}</h2>
              <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '32px'
          }}>{t("visible.2502925ede0c")}</p>

              <form onSubmit={handleMfaSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
                <div>
                  <label style={labelStyle}>{t("visible.cdf35559a4b2")}</label>
                  <input type="text" name="code" value={mfaData.code} onChange={handleChange(setMfaData)} maxLength="6" pattern="\d{6}" style={{
                ...fieldStyle,
                textAlign: 'center',
                fontSize: '28px',
                letterSpacing: '0.5em',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: '600'
              }} placeholder={t("visible.91b4d142823f")} />
                </div>
                <div>
                  <label style={labelStyle}>{t("visible.a0298b2b1be3")}</label>
                  <input type="text" name="recoveryCode" value={mfaData.recoveryCode} onChange={handleChange(setMfaData)} style={fieldStyle} placeholder={t("visible.37e0ed0ff996")} />
                </div>
                <button type="submit" disabled={isSubmitting} className="button-primary" style={{
              width: '100%',
              padding: '14px'
            }}>
                  {isSubmitting ? t('runtime.verifying') : t('runtime.confirmSignIn')}
                </button>
                <button type="button" onClick={() => setMode('login')} className="button-ghost" style={{
              width: '100%'
            }}>{t("visible.5e6337351f9b")}</button>
              </form>
            </div>}

          {/* ─── Forgot Password ─── */}
          {mode === 'forgot' && <div>
              <p className="eyebrow" style={{
            marginBottom: '8px'
          }}>{t("visible.93982d33c506")}</p>
              <h2 style={{
            fontSize: '32px',
            fontWeight: '800',
            color: '#fff',
            letterSpacing: '-0.03em',
            marginBottom: '6px'
          }}>{t("visible.456d421c453e")}</h2>
              <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '32px'
          }}>{t("visible.bfbcba8aa27f")}</p>

              <form onSubmit={handleForgotSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
                <div>
                  <label style={labelStyle}>{t("visible.09bf25ef3083")}</label>
                  <input required type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} style={fieldStyle} placeholder={t("visible.cff71654db99")} />
                </div>
                <button type="submit" disabled={isSubmitting} className="button-primary" style={{
              width: '100%',
              padding: '14px'
            }}>
                  {isSubmitting ? t('runtime.requesting') : t('runtime.requestReset')}
                </button>
                <button type="button" onClick={() => setMode('login')} className="button-ghost" style={{
              width: '100%'
            }}>{t("visible.5e6337351f9b")}</button>
              </form>
            </div>}

          {/* ─── Reset Password ─── */}
          {mode === 'reset' && <div>
              <p className="eyebrow" style={{
            marginBottom: '8px'
          }}>{t("visible.daa631d8c5a0")}</p>
              <h2 style={{
            fontSize: '32px',
            fontWeight: '800',
            color: '#fff',
            letterSpacing: '-0.03em',
            marginBottom: '6px'
          }}>{t("visible.4e70f1fd24ba")}</h2>
              <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '32px'
          }}>{t("visible.af456515c166")}</p>

              <form onSubmit={handleResetSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
                <div>
                  <label style={labelStyle}>{t("visible.74b3ca264e52")}</label>
                  <input required type="text" name="token" value={resetData.token} onChange={handleChange(setResetData)} style={fieldStyle} placeholder={t("visible.016956df77b1")} />
                </div>
                <div>
                  <label style={labelStyle}>{t("visible.7c451e0f436d")}</label>
                  <input required type="password" name="newPassword" value={resetData.newPassword} onChange={handleChange(setResetData)} style={fieldStyle} placeholder={t("visible.0ced89a646c1")} />
                </div>
                <button type="submit" disabled={isSubmitting} className="button-primary" style={{
              width: '100%',
              padding: '14px'
            }}>
                  {isSubmitting ? t('runtime.resetting') : t('runtime.changePassword')}
                </button>
                <button type="button" onClick={() => setMode('login')} className="button-ghost" style={{
              width: '100%'
            }}>{t("visible.19766ed6ccb2")}</button>
              </form>
            </div>}

          {/* ─── NGO Registration ─── */}
          {mode === 'register_ngo' && <div>
              <p className="eyebrow" style={{
            marginBottom: '8px'
          }}>{t("visible.b5f2155ea02e")}</p>
              <h2 style={{
            fontSize: '28px',
            fontWeight: '800',
            color: '#fff',
            letterSpacing: '-0.03em',
            marginBottom: '6px'
          }}>{t("visible.096a5aa5c4b1")}</h2>
              <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '24px'
          }}>{t("visible.22c4b7fcf580")}</p>

              <form onSubmit={handleNgoSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: '420px',
            overflowY: 'auto',
            paddingRight: '4px'
          }}>
                <div>
                  <label style={labelStyle}>{t("visible.4a1ea422b0a7")}</label>
                  <input required type="text" name="name" value={ngoData.name} onChange={handleChange(setNgoData)} style={fieldStyle} placeholder={t("visible.60e7a8d731a1")} />
                </div>
                <div>
                  <label style={labelStyle}>{t("visible.6c6d7349bcf0")}</label>
                  <input required type="email" name="email" value={ngoData.email} onChange={handleChange(setNgoData)} style={fieldStyle} placeholder={t("visible.8adec9eab3df")} />
                </div>
                <div>
                  <label style={labelStyle}>{t("visible.c9cbc7f885bd")}</label>
                  <input required type="password" name="password" value={ngoData.password} onChange={handleChange(setNgoData)} style={fieldStyle} placeholder={t("visible.f56173fa2e73")} />
                </div>
                <div>
                  <label style={labelStyle}>{t("visible.9e72a8fda746")}</label>
                  <input required type="text" name="phone" value={ngoData.phone} onChange={handleChange(setNgoData)} style={fieldStyle} placeholder={t("visible.4a11e501ccb9")} />
                </div>
                <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px'
            }}>
                  <div>
                    <label style={labelStyle}>{t("visible.aa5833fdda91")}</label>
                    <input required type="text" name="city" value={ngoData.city} onChange={handleChange(setNgoData)} style={fieldStyle} placeholder={t("visible.fc33f73246f4")} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t("visible.4954aecbbe39")}</label>
                    <input required type="text" name="district" value={ngoData.district} onChange={handleChange(setNgoData)} style={fieldStyle} placeholder={t("visible.50f1878d24fe")} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>{t("visible.ec27c12a3670")}</label>
                  <textarea name="description" value={ngoData.description} onChange={handleChange(setNgoData)} rows="3" style={{
                ...fieldStyle,
                resize: 'vertical',
                minHeight: '80px'
              }} placeholder={t("visible.73f608c0de22")} />
                </div>
                <button type="submit" disabled={isSubmitting} className="button-primary" style={{
              width: '100%',
              padding: '14px',
              marginTop: '4px'
            }}>
                  {isSubmitting ? t('runtime.registering') : t('runtime.submitNgo')}
                </button>
                <button type="button" onClick={() => setMode('login')} className="button-ghost" style={{
              width: '100%'
            }}>{t("visible.19766ed6ccb2")}</button>
              </form>
            </div>}
        </div>
      </div>
    </div>;
}
