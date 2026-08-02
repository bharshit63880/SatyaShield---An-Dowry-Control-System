import { useLanguage } from "../context/LanguageContext";
import { startTransition, useState } from 'react';
import { submitComplaintRequest } from '../services/api';
import { buildRecoveryCardContent } from '../utils/recovery-card';
import { AI_DISCLOSURE_VERSION, CONSENT_VERSION, PRIVACY_NOTICE_VERSION } from '../config/privacy';
const acceptedFileTypes = 'image/png,image/jpeg,image/webp';
const STEPS = [{
  id: 1,
  labelKey: 'visible.36a606d48865',
  icon: '📋'
}, {
  id: 2,
  labelKey: 'visible.03867aea70ac',
  icon: '📁'
}, {
  id: 3,
  labelKey: 'visible.155f816c0407',
  icon: '✅'
}];
const initialFormState = {
  complaintCategory: 'dowry_harassment',
  preferredLanguage: '',
  dangerHappeningNow: 'unknown',
  immediateThreatToLife: 'unknown',
  weaponInvolved: 'unknown',
  seriousInjuryPresent: 'unknown',
  currentlyConfined: 'unknown',
  threatEscalating: 'unknown',
  stalkingOrRepeatedContact: 'unknown',
  vulnerablePersonAtRisk: 'unknown',
  urgentMedicalHelpNeeded: 'unknown',
  canSafelyContinue: 'unknown',
  reporterUrgency: 'unknown',
  incidentRecency: 'unknown',
  description: '',
  city: '',
  district: '',
  locationConsent: false,
  website: '',
  media: null,
  privacyAcknowledged: false,
  aiConsent: false
};
function StepIndicator({
  currentStep
}) {
  const { t } = useLanguage();
  return <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0',
    marginBottom: '40px'
  }}>
      {STEPS.map((step, i) => <div key={step.id} style={{
      display: 'flex',
      alignItems: 'center'
    }}>
          {/* Step circle */}
          <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        fontWeight: '700',
        transition: 'all 0.3s ease',
        ...(currentStep > step.id ? {
          background: 'rgba(0,229,204,0.2)',
          border: '2px solid #00e5cc',
          color: '#00e5cc',
          boxShadow: '0 0 15px rgba(0,229,204,0.2)'
        } : currentStep === step.id ? {
          background: 'linear-gradient(135deg, #00e5cc 0%, #00b8a3 100%)',
          border: '2px solid #00e5cc',
          color: '#060b14',
          boxShadow: '0 0 20px rgba(0,229,204,0.4)'
        } : {
          background: 'rgba(255,255,255,0.04)',
          border: '2px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.25)'
        })
      }}>
            {currentStep > step.id ? '✓' : step.icon}
          </div>
          {/* Step label */}
          <div style={{
        marginLeft: '8px',
        marginRight: i < STEPS.length - 1 ? '0' : '0'
      }}>
            <div style={{
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: currentStep === step.id ? '#00e5cc' : currentStep > step.id ? 'rgba(0,229,204,0.6)' : 'rgba(255,255,255,0.25)'
        }}>
              {t(step.labelKey)}
            </div>
          </div>
          {/* Connector line */}
          {i < STEPS.length - 1 && <div style={{
        width: '48px',
        height: '2px',
        margin: '0 12px',
        background: currentStep > step.id ? 'linear-gradient(90deg, #00e5cc, rgba(0,229,204,0.4))' : 'rgba(255,255,255,0.08)'
      }} />}
        </div>)}
    </div>;
}
function SuccessScreen({
  data
}) {
  const {
    t
  } = useLanguage();
  const [copyStatus, setCopyStatus] = useState('');
  async function copyValue(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus(t('runtime.copyBlocked'));
    }
  }
  function downloadRecoveryCard() {
    const content = buildRecoveryCardContent(data);
    const url = URL.createObjectURL(new Blob([content], {
      type: 'text/plain;charset=utf-8'
    }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'satyashield-recovery-card.txt';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return <div style={{
    textAlign: 'center',
    padding: '32px'
  }}>
      <div style={{
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      background: 'rgba(0,229,204,0.1)',
      border: '2px solid #00e5cc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '36px',
      margin: '0 auto 24px',
      boxShadow: '0 0 40px rgba(0,229,204,0.3)'
    }}>
        🛡️
      </div>
      <h3 style={{
      fontSize: '26px',
      fontWeight: '800',
      color: '#fff',
      marginBottom: '8px',
      letterSpacing: '-0.02em'
    }}>{t("visible.ca6b4cc4ce09")}</h3>
      <p style={{
      fontSize: '14px',
      color: 'rgba(255,255,255,0.5)',
      marginBottom: '32px',
      maxWidth: '360px',
      margin: '0 auto 32px'
    }}>{t("visible.6e4cd86652ae")}</p>

      {/* Anonymous ID */}
      <div style={{
      background: 'rgba(0,229,204,0.06)',
      border: '1px solid rgba(0,229,204,0.25)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '24px',
      textAlign: 'left'
    }}>
        <p style={{
        fontSize: '10px',
        fontWeight: '700',
        color: '#00e5cc',
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        marginBottom: '8px'
      }}>{t("visible.399eae0c2627")}</p>
        <p style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '16px',
        fontWeight: '600',
        color: '#00e5cc',
        marginBottom: '16px',
        background: 'rgba(0,0,0,0.3)',
        padding: '10px 14px',
        borderRadius: '8px',
        letterSpacing: '0.05em'
      }}>
          {data.caseId}
        </p>

        <p style={{
        fontSize: '10px',
        fontWeight: '700',
        color: '#00e5cc',
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        marginBottom: '8px'
      }}>{t("visible.60a01746e30d")}</p>
        <p style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '14px',
        color: '#fff',
        overflowWrap: 'anywhere',
        background: 'rgba(0,0,0,0.3)',
        padding: '10px 14px',
        borderRadius: '8px'
      }}>
          {data.accessSecret}
        </p>
        <p style={{
        marginTop: '16px',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.6)'
      }}>{t("visible.d70b9e24bca2")}{new Date(data.createdAt).toLocaleString()}
        </p>
        <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        marginTop: '18px'
      }}>
          <button type="button" className="button-secondary" onClick={() => copyValue('Case ID', data.caseId)}>{t("visible.36949b811aa9")}</button>
          <button type="button" className="button-secondary" onClick={() => copyValue('Access secret', data.accessSecret)}>{t("visible.1c2a04e52b2a")}</button>
          <button type="button" className="button-secondary" onClick={() => copyValue('Case credentials', `Case ID: ${data.caseId}\nAccess secret: ${data.accessSecret}`)}>{t("visible.8c46d2e807c5")}</button>
          <button type="button" className="button-primary" onClick={downloadRecoveryCard}>{t("visible.b60911e1d9d3")}</button>
        </div>
        {copyStatus ? <p style={{
        marginTop: '12px',
        fontSize: '12px',
        color: '#00e5cc'
      }}>{copyStatus}</p> : null}

        <div style={{
        display: 'none',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px'
      }}>
          <div>
            <p style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.35)',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}>{t("visible.920e413c7d41")}</p>
            <p style={{
            fontSize: '13px',
            color: '#00ff88',
            fontWeight: '600'
          }}>{data.status}</p>
          </div>
          <div>
            <p style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.35)',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}>{t("visible.15b61974b270")}</p>
            <p style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            fontWeight: '600'
          }}>
              {data.locationConsent && data.approximateLocation ? data.approximateLocation : t('runtime.notShared')}
            </p>
          </div>
          <div style={{
          gridColumn: '1 / -1'
        }}>
            <p style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.35)',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}>{t("visible.115a2cc92c10")}</p>
            <p style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            fontWeight: '600'
          }}>
              {new Date(data.timestamp).toLocaleString()}
            </p>
          </div>
        </div>

      </div>

      <div className="alert-warning" style={{
      textAlign: 'left',
      marginBottom: '12px'
    }}>{t("visible.54a33ad02c12")}</div>
      <div className="alert-warning" style={{
      textAlign: 'left'
    }}>{t("visible.c721f0ac36e0")}</div>
    </div>;
}
export function ComplaintPage() {
  const {
    t
  } = useLanguage();
  const [step, setStep] = useState(1);
  const [formState, setFormState] = useState(initialFormState);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    fontSize: '11px',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '8px'
  };
  function handleChange(e) {
    const {
      name,
      value,
      type,
      checked
    } = e.target;
    setFormState(s => ({
      ...s,
      [name]: type === 'checkbox' ? checked : value
    }));
  }
  function handleFileChange(e) {
    const file = e.target.files?.[0] ?? null;
    setFormState(s => ({
      ...s,
      media: file
    }));
  }
  function canProceedStep1() {
    return formState.description.trim().length > 10;
  }
  async function handleSubmit() {
    setErrorMessage('');
    setIsSubmitting(true);
    setSuccessData(null);
    const payload = new FormData();
    payload.append('description', formState.description);
    payload.append('complaintCategory', formState.complaintCategory);
    payload.append('preferredLanguage', formState.preferredLanguage);
    for (const field of ['dangerHappeningNow', 'immediateThreatToLife', 'weaponInvolved', 'seriousInjuryPresent', 'currentlyConfined', 'threatEscalating', 'stalkingOrRepeatedContact', 'vulnerablePersonAtRisk', 'urgentMedicalHelpNeeded', 'canSafelyContinue', 'reporterUrgency', 'incidentRecency']) payload.append(field, formState[field]);
    payload.append('city', formState.city);
    payload.append('district', formState.district);
    payload.append('locationConsent', String(formState.locationConsent));
    payload.append('website', formState.website);
    payload.append('privacyAcknowledged', String(formState.privacyAcknowledged));
    payload.append('privacyNoticeVersion', PRIVACY_NOTICE_VERSION);
    payload.append('consentVersion', CONSENT_VERSION);
    payload.append('aiConsent', String(formState.aiConsent));
    payload.append('aiDisclosureVersion', AI_DISCLOSURE_VERSION);
    if (formState.media) payload.append('media', formState.media);
    try {
      const response = await submitComplaintRequest(payload);
      startTransition(() => {
        setSuccessData(response.data);
        setFormState(initialFormState);
        setStep(1);
      });
    } catch (err) {
      setErrorMessage(t('runtime.genericRequestFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }
  return <div className="page-shell py-8 sm:py-12">
      <div className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-6" style={{
      alignItems: 'start'
    }}>

        {/* ─── Left Info Panel ─── */}
        <section className="xl:sticky xl:top-[96px]" style={{
        background: 'linear-gradient(135deg, rgba(0,229,204,0.06) 0%, rgba(124,58,237,0.04) 100%)',
        border: '1px solid rgba(0,229,204,0.15)',
        borderRadius: '20px',
        padding: '32px'
      }}>
          <p className="eyebrow" style={{
          marginBottom: '12px'
        }}>{t("visible.ce5383302a93")}</p>
          <h1 style={{
          fontSize: 'clamp(24px, 3vw, 36px)',
          fontWeight: '800',
          color: '#fff',
          lineHeight: '1.2',
          letterSpacing: '-0.03em',
          marginBottom: '16px'
        }}>{t("visible.29d45122c4be")}</h1>
          <p style={{
          fontSize: '14px',
          lineHeight: '1.7',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: '28px'
        }}>{t("visible.e63b90c8212c")}</p>

          <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '28px'
        }}>
            {[{
            icon: '🔑',
            textKey: 'visible.4e87842c16ad'
          }, {
            icon: '🔐',
            textKey: 'visible.efffcce471a3'
          }, {
            icon: '📍',
            textKey: 'visible.9aec09d00766'
          }, {
            icon: '🤖',
            textKey: 'visible.a9143c4c9480'
          }].map(item => <div key={item.textKey} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '12px 14px'
          }}>
                <span style={{
              fontSize: '18px',
              flexShrink: 0
            }}>{item.icon}</span>
                <span style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.65)',
              lineHeight: '1.5'
            }}>{t(item.textKey)}</span>
              </div>)}
          </div>

          {/* Anonymous ID generation preview */}
          <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '12px',
          padding: '16px'
        }}>
            <p style={{
            fontSize: '10px',
            fontWeight: '700',
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>{t("visible.b26ad4727925")}</p>
            <p style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
            color: 'rgba(0,229,204,0.6)',
            letterSpacing: '0.05em'
          }}>
              anon-{Math.random().toString(36).slice(2, 8)}-****
            </p>
            <p style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.25)',
            marginTop: '6px'
          }}>{t("visible.0b2aa65dbd5e")}</p>
          </div>

          {/* Trust note */}
          <div className="alert-warning" style={{
          marginTop: '16px'
        }}>
            <strong>{t("visible.49bc38bffb3a")}</strong>{t("visible.8efb9b576ad6")}</div>
        </section>

        {/* ─── Right Form Panel ─── */}
        <section style={{
        background: 'rgba(13,20,32,0.95)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
      }}>
          {successData ? <SuccessScreen data={successData} /> : <>
              {/* Step indicator */}
              <StepIndicator currentStep={step} />

              {/* Error */}
              {errorMessage && <div className="alert-error" style={{
            marginBottom: '24px'
          }}>
                  ⚠️ {errorMessage}
                </div>}

              {/* ─── Step 1: Incident Details ─── */}
              {step === 1 && <div className="animate-fadeIn">
                  <p className="eyebrow" style={{
              marginBottom: '8px'
            }}>{t("visible.a56fdaed4612")}</p>
                  <h2 style={{
              fontSize: '26px',
              fontWeight: '800',
              color: '#fff',
              marginBottom: '6px',
              letterSpacing: '-0.02em'
            }}>{t("visible.d9517cb17b5d")}</h2>
                  <p style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '28px'
            }}>{t("visible.05cacded45c6")}</p>

                  <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
                    <div className="alert-warning">{t("visible.3313cfeedc8f")}</div>
                    {[['dangerHappeningNow', 'Is danger happening now?'], ['immediateThreatToLife', 'Is there an immediate threat to life?'], ['weaponInvolved', 'Is a weapon involved?'], ['seriousInjuryPresent', 'Is there a serious injury?'], ['currentlyConfined', 'Is anyone currently prevented from leaving?'], ['threatEscalating', 'Is the threat escalating?'], ['stalkingOrRepeatedContact', 'Is stalking or repeated unwanted contact occurring?'], ['vulnerablePersonAtRisk', 'May a child or another vulnerable person be at risk?'], ['urgentMedicalHelpNeeded', 'Does someone appear to need urgent medical help?'], ['canSafelyContinue', 'Can you safely continue using this application?']].map(([name, label]) => <div key={name}>
                        <label htmlFor={`triage-${name}`} style={labelStyle}>{label}</label>
                        <select id={`triage-${name}`} name={name} value={formState[name]} onChange={handleChange} style={fieldStyle}>
                          <option value="unknown">{t("visible.b764cdc0eab7")}</option>
                          <option value="yes">{t("visible.85a39ab345d6")}</option>
                          <option value="no">{t("visible.1ea442a134b2")}</option>
                          <option value="prefer_not_to_say">{t("visible.51fcc57e9bf9")}</option>
                        </select>
                      </div>)}
                    <div className="responsive-two-column">
                      <div><label htmlFor="reporterUrgency" style={labelStyle}>{t("visible.9976d1f1cf76")}</label>
                        <select id="reporterUrgency" name="reporterUrgency" value={formState.reporterUrgency} onChange={handleChange} style={fieldStyle}>
                          <option value="unknown">{t("visible.b764cdc0eab7")}</option><option value="routine">{t("visible.266d8ceb18ba")}</option>
                          <option value="concerned">{t("visible.c1f0fd954185")}</option><option value="urgent">{t("visible.1b015904cc17")}</option>
                          <option value="prefer_not_to_say">{t("visible.51fcc57e9bf9")}</option>
                        </select></div>
                      <div><label htmlFor="incidentRecency" style={labelStyle}>{t("visible.639a5918c034")}</label>
                        <select id="incidentRecency" name="incidentRecency" value={formState.incidentRecency} onChange={handleChange} style={fieldStyle}>
                          <option value="unknown">{t("visible.b764cdc0eab7")}</option><option value="happening_now">{t("visible.00e5738136a2")}</option>
                          <option value="within_24_hours">{t("visible.fda2336f86f8")}</option><option value="within_week">{t("visible.61a85280f371")}</option>
                          <option value="historical">{t("visible.7be303f8f3cb")}</option><option value="prefer_not_to_say">{t("visible.51fcc57e9bf9")}</option>
                        </select></div>
                    </div>
                    <div className="responsive-two-column">
                      <div>
                        <label htmlFor="complaintCategory" style={labelStyle}>{t("visible.3416ae79df9b")}</label>
                        <select id="complaintCategory" name="complaintCategory" value={formState.complaintCategory} onChange={handleChange} style={fieldStyle}>
                          <option value="dowry_harassment">{t("visible.04d2c8a4a0da")}</option>
                          <option value="domestic_violence">{t("visible.ce61034d9277")}</option>
                          <option value="legal_support">{t("visible.df1eacba3150")}</option>
                          <option value="safety_planning">{t("visible.dd68a1488bc2")}</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="preferredLanguage" style={labelStyle}>{t("visible.7b367256b126")}</label>
                        <input id="preferredLanguage" name="preferredLanguage" value={formState.preferredLanguage} onChange={handleChange} style={fieldStyle} placeholder={t("visible.0cce431ae7b7")} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="incidentDescription" style={labelStyle}>{t("visible.3d4711a42ea4")}</label>
                      <textarea id="incidentDescription" name="description" rows="7" value={formState.description} onChange={handleChange} style={{
                  ...fieldStyle,
                  resize: 'vertical',
                  minHeight: '160px'
                }} placeholder={t("visible.988c969d066f")} />
                      <p style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.25)',
                  marginTop: '6px'
                }}>
                        {formState.description.length}{t("visible.ae628a99443c")}</p>
                    </div>

                    <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px'
              }}>
                      <div>
                        <label style={labelStyle}>{t("visible.356cfad4097b")}</label>
                        <input type="text" name="city" value={formState.city} onChange={handleChange} style={fieldStyle} placeholder={t("visible.2287465ddfd1")} />
                      </div>
                      <div>
                        <label style={labelStyle}>{t("visible.1e272dbf9b9d")}</label>
                        <input type="text" name="district" value={formState.district} onChange={handleChange} style={fieldStyle} placeholder={t("visible.aca6a5eaf2d2")} />
                      </div>
                    </div>

                    {/* Location Consent */}
                    <div style={{
                background: 'rgba(0,229,204,0.04)',
                border: '1px solid rgba(0,229,204,0.15)',
                borderRadius: '12px',
                padding: '16px'
              }}>
                      <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  cursor: 'pointer'
                }}>
                        <input type="checkbox" name="locationConsent" checked={formState.locationConsent} onChange={handleChange} style={{
                    marginTop: '2px',
                    width: '18px',
                    height: '18px',
                    accentColor: '#00e5cc',
                    flexShrink: 0
                  }} />
                        <span>
                          <span style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#fff',
                      marginBottom: '4px'
                    }}>{t("visible.94f7ca121aac")}</span>
                          <span style={{
                      display: 'block',
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.4)',
                      lineHeight: '1.5'
                    }}>{t("visible.8183d3344271")}</span>
                        </span>
                      </label>
                    </div>
                  </div>

                  <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '28px'
            }}>
                    <button type="button" onClick={() => setStep(2)} disabled={!canProceedStep1()} className="button-primary" style={{
                padding: '13px 32px',
                fontSize: '14px'
              }}>{t("visible.aa8e556d8572")}</button>
                  </div>
                </div>}

              {/* ─── Step 2: Evidence Upload ─── */}
              {step === 2 && <div className="animate-fadeIn">
                  <p className="eyebrow" style={{
              marginBottom: '8px'
            }}>{t("visible.a239df1b9493")}</p>
                  <h2 style={{
              fontSize: '26px',
              fontWeight: '800',
              color: '#fff',
              marginBottom: '6px',
              letterSpacing: '-0.02em'
            }}>{t("visible.934d6a4d929b")}</h2>
                  <p style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '28px'
            }}>{t("visible.1451b78c8391")}</p>

                  {/* Upload zone */}
                  <div style={{
              border: `2px dashed ${formState.media ? 'rgba(0,229,204,0.4)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '16px',
              padding: '40px 24px',
              textAlign: 'center',
              background: formState.media ? 'rgba(0,229,204,0.04)' : 'rgba(0,0,0,0.2)',
              transition: 'all 0.3s ease',
              position: 'relative',
              marginBottom: '20px'
            }}>
                    <input type="file" name="media" accept={acceptedFileTypes} onChange={handleFileChange} style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%'
              }} />
                    {formState.media ? <>
                        <div style={{
                  fontSize: '36px',
                  marginBottom: '12px'
                }}>📎</div>
                        <p style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#00e5cc',
                  marginBottom: '4px'
                }}>
                          {formState.media.name}
                        </p>
                        <p style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.35)'
                }}>
                          {(formState.media.size / 1024 / 1024).toFixed(2)}{t("visible.414d1c4fba0e")}</p>
                      </> : <>
                        <div style={{
                  fontSize: '40px',
                  marginBottom: '12px',
                  opacity: 0.5
                }}>📁</div>
                        <p style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '6px'
                }}>{t("visible.af10ec0fe882")}</p>
                        <p style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.3)'
                }}>{t("visible.a6f0737774b7")}</p>
                      </>}
                  </div>

                  {/* Privacy notice */}
                  <div style={{
              background: 'rgba(124,58,237,0.06)',
              border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '28px'
            }}>
                    <p style={{
                fontSize: '12px',
                color: 'rgba(200,180,255,0.8)',
                lineHeight: '1.5',
                margin: 0
              }}>
                      🔒 <strong>{t("visible.564acbf41ea0")}</strong>{t("visible.fd6a041d3aca")}</p>
                  </div>

                  <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'space-between'
            }}>
                    <button type="button" onClick={() => setStep(1)} className="button-ghost" style={{
                padding: '12px 24px'
              }}>{t("visible.aceb696a04c1")}</button>
                    <button type="button" onClick={() => setStep(3)} className="button-primary" style={{
                padding: '13px 32px',
                fontSize: '14px'
              }}>{t("visible.59b620a9d336")}</button>
                  </div>
                </div>}

              {/* ─── Step 3: Review & Submit ─── */}
              {step === 3 && <div className="animate-fadeIn">
                  <p className="eyebrow" style={{
              marginBottom: '8px'
            }}>{t("visible.6ebbc7b1007b")}</p>
                  <h2 style={{
              fontSize: '26px',
              fontWeight: '800',
              color: '#fff',
              marginBottom: '6px',
              letterSpacing: '-0.02em'
            }}>{t("visible.e877c5633a0b")}</h2>
                  <p style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '28px'
            }}>{t("visible.52410bb8df07")}</p>

                  {/* Summary */}
                  <div style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '14px',
              overflow: 'hidden',
              marginBottom: '24px'
            }}>
                    <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
              }}>
                      <p style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  color: 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}>{t("visible.6409a5654746")}</p>
                      <p style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: '1.6'
                }}>
                        {formState.description.slice(0, 200)}{formState.description.length > 200 ? '...' : ''}
                      </p>
                    </div>
                    <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                padding: '16px 20px',
                gap: '16px'
              }}>
                      <div>
                        <p style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    color: 'rgba(255,255,255,0.3)',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    marginBottom: '4px'
                  }}>{t("visible.15b61974b270")}</p>
                        <p style={{
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.7)'
                  }}>
                          {formState.city || formState.district ? `${formState.city} ${formState.district}`.trim() : t('runtime.notProvided')}
                        </p>
                      </div>
                      <div>
                        <p style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    color: 'rgba(255,255,255,0.3)',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    marginBottom: '4px'
                  }}>{t("visible.d37e0cd00f18")}</p>
                        <p style={{
                    fontSize: '13px',
                    color: formState.locationConsent ? '#00e5cc' : 'rgba(255,255,255,0.4)'
                  }}>
                          {formState.locationConsent ? t('runtime.granted') : t('runtime.notGranted')}
                        </p>
                      </div>
                      <div>
                        <p style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    color: 'rgba(255,255,255,0.3)',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    marginBottom: '4px'
                  }}>{t("visible.03867aea70ac")}</p>
                        <p style={{
                    fontSize: '13px',
                    color: formState.media ? '#00e5cc' : 'rgba(255,255,255,0.4)'
                  }}>
                          {formState.media ? t('runtime.fileAttached') : t('runtime.none')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Final security notice */}
                  <div className="alert-success" style={{
              marginBottom: '24px'
            }}>{t("visible.462ff891febe")}</div>

                  <div style={{
              display: 'grid',
              gap: '12px',
              marginBottom: '24px'
            }}>
                    <label style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start'
              }}>
                      <input type="checkbox" name="privacyAcknowledged" checked={formState.privacyAcknowledged} onChange={handleChange} />
                      <span style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,.7)'
                }}>{t("visible.6b1badac9c85")}<a href="/privacy">{t("visible.f18dccf66b7c")}</a>{t("visible.dd6213d9edc4")}</span>
                    </label>
                    <label style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start'
              }}>
                      <input type="checkbox" name="aiConsent" checked={formState.aiConsent} onChange={handleChange} />
                      <span style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,.7)'
                }}>{t("visible.f616812fd4b7")}</span>
                    </label>
                  </div>

                  {/* Honeypot */}
                  <input type="text" name="website" value={formState.website} onChange={handleChange} tabIndex="-1" autoComplete="off" style={{
              display: 'none'
            }} aria-hidden="true" />

                  <div style={{
              display: 'flex',
              gap: '12px'
            }}>
                    <button type="button" onClick={() => setStep(2)} className="button-ghost" style={{
                padding: '13px 24px'
              }}>{t("visible.aceb696a04c1")}</button>
                    <button type="button" onClick={handleSubmit} disabled={isSubmitting || !formState.privacyAcknowledged} className="button-primary" style={{
                flex: 1,
                padding: '14px',
                fontSize: '15px'
              }}>
                      {isSubmitting ? t('runtime.encryptingSubmit') : t('runtime.submitAnonymous')}
                    </button>
                  </div>
                </div>}
            </>}
        </section>
      </div>
    </div>;
}
