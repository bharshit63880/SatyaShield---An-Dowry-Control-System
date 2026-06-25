import { startTransition, useState } from 'react';
import { submitComplaintRequest } from '../services/api';

const acceptedFileTypes = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime';

const STEPS = [
  { id: 1, label: 'Incident', icon: '📋' },
  { id: 2, label: 'Evidence', icon: '📁' },
  { id: 3, label: 'Submit', icon: '✅' }
];

const initialFormState = {
  description: '',
  city: '',
  district: '',
  locationConsent: false,
  website: '',
  media: null
};

function StepIndicator({ currentStep }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0',
      marginBottom: '40px'
    }}>
      {STEPS.map((step, i) => (
        <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
          {/* Step circle */}
          <div style={{
            width: '44px', height: '44px',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
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
              {step.label}
            </div>
          </div>
          {/* Connector line */}
          {i < STEPS.length - 1 && (
            <div style={{
              width: '48px', height: '2px',
              margin: '0 12px',
              background: currentStep > step.id
                ? 'linear-gradient(90deg, #00e5cc, rgba(0,229,204,0.4))'
                : 'rgba(255,255,255,0.08)'
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

function SuccessScreen({ data }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px' }}>
      <div style={{
        width: '80px', height: '80px',
        borderRadius: '50%',
        background: 'rgba(0,229,204,0.1)',
        border: '2px solid #00e5cc',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '36px',
        margin: '0 auto 24px',
        boxShadow: '0 0 40px rgba(0,229,204,0.3)'
      }}>
        🛡️
      </div>
      <h3 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', marginBottom: '8px', letterSpacing: '-0.02em' }}>
        Report Submitted Successfully
      </h3>
      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '32px', maxWidth: '360px', margin: '0 auto 32px' }}>
        Your anonymous report has been received and encrypted. Save your Anonymous ID to track this case.
      </p>

      {/* Anonymous ID */}
      <div style={{
        background: 'rgba(0,229,204,0.06)',
        border: '1px solid rgba(0,229,204,0.25)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        textAlign: 'left'
      }}>
        <p style={{ fontSize: '10px', fontWeight: '700', color: '#00e5cc', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '8px' }}>
          🔑 Anonymous Case ID
        </p>
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
          {data.anonymousId}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</p>
            <p style={{ fontSize: '13px', color: '#00ff88', fontWeight: '600' }}>{data.status}</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Location</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
              {data.locationConsent && data.approximateLocation ? data.approximateLocation : 'Not shared'}
            </p>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Timestamp</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
              {new Date(data.timestamp).toLocaleString()}
            </p>
          </div>
        </div>

        {data.mediaUrl && (
          <a href={data.mediaUrl} target="_blank" rel="noreferrer" className="button-secondary"
            style={{ marginTop: '16px', display: 'inline-flex', fontSize: '13px' }}>
            📎 View Uploaded Evidence
          </a>
        )}
      </div>

      <div className="alert-warning" style={{ textAlign: 'left' }}>
        ⚠️ Save this Anonymous ID securely. It's your only way to track or update this complaint. SatyaShield does not store your identity.
      </div>
    </div>
  );
}

export function ComplaintPage() {
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
    const { name, value, type, checked } = e.target;
    setFormState((s) => ({ ...s, [name]: type === 'checkbox' ? checked : value }));
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0] ?? null;
    setFormState((s) => ({ ...s, media: file }));
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
    payload.append('city', formState.city);
    payload.append('district', formState.district);
    payload.append('locationConsent', String(formState.locationConsent));
    payload.append('website', formState.website);
    if (formState.media) payload.append('media', formState.media);

    try {
      const response = await submitComplaintRequest(payload);
      startTransition(() => {
        setSuccessData(response.data.complaint);
        setFormState(initialFormState);
        setStep(1);
      });
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-shell py-8 sm:py-12">
      <div
        className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-6"
        style={{ alignItems: 'start' }}
      >

        {/* ─── Left Info Panel ─── */}
        <section
          className="xl:sticky xl:top-[96px]"
          style={{
            background: 'linear-gradient(135deg, rgba(0,229,204,0.06) 0%, rgba(124,58,237,0.04) 100%)',
            border: '1px solid rgba(0,229,204,0.15)',
            borderRadius: '20px',
            padding: '32px'
          }}
        >
          <p className="eyebrow" style={{ marginBottom: '12px' }}>Anonymous Reporting</p>
          <h1 style={{
            fontSize: 'clamp(24px, 3vw, 36px)',
            fontWeight: '800',
            color: '#fff',
            lineHeight: '1.2',
            letterSpacing: '-0.03em',
            marginBottom: '16px'
          }}>
            Built to feel safe before you share a single word.
          </h1>
          <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgba(255,255,255,0.5)', marginBottom: '28px' }}>
            No login required. No GPS coordinates. No identity fields. A safe, modern reporting flow with consent-based location and privacy-protected media intake.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
            {[
              { icon: '🔑', text: 'Automatic anonymous ID for every report' },
              { icon: '🗑️', text: 'EXIF metadata stripped from all media uploads' },
              { icon: '📍', text: 'Approximate location only, with consent' },
              { icon: '🤖', text: 'AI risk assessment & NGO routing' }
            ].map((item) => (
              <div key={item.text} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '12px 14px'
              }}>
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.5' }}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Anonymous ID generation preview */}
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <p style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '8px' }}>
              🔒 Your Anon ID Preview
            </p>
            <p style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '13px',
              color: 'rgba(0,229,204,0.6)',
              letterSpacing: '0.05em'
            }}>
              anon-{Math.random().toString(36).slice(2, 8)}-****
            </p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
              Generated on submission — never stored with your identity
            </p>
          </div>

          {/* Trust note */}
          <div className="alert-warning" style={{ marginTop: '16px' }}>
            <strong>Trust Note:</strong> Personal identity is intentionally not collected. Avoid mentioning exact address, phone number, or GPS coordinates.
          </div>
        </section>

        {/* ─── Right Form Panel ─── */}
        <section style={{
          background: 'rgba(13,20,32,0.95)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px',
          padding: '40px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
        }}>
          {successData ? (
            <SuccessScreen data={successData} />
          ) : (
            <>
              {/* Step indicator */}
              <StepIndicator currentStep={step} />

              {/* Error */}
              {errorMessage && (
                <div className="alert-error" style={{ marginBottom: '24px' }}>
                  ⚠️ {errorMessage}
                </div>
              )}

              {/* ─── Step 1: Incident Details ─── */}
              {step === 1 && (
                <div className="animate-fadeIn">
                  <p className="eyebrow" style={{ marginBottom: '8px' }}>Step 1 of 3</p>
                  <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                    Describe the Incident
                  </h2>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '28px' }}>
                    Share as much or as little as you're comfortable with.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <label style={labelStyle}>Incident Description *</label>
                      <textarea
                        name="description"
                        rows="7"
                        value={formState.description}
                        onChange={handleChange}
                        style={{ ...fieldStyle, resize: 'vertical', minHeight: '160px' }}
                        placeholder="Describe the dowry harassment incident — what happened, when, who was involved (no real names needed)..."
                      />
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
                        {formState.description.length} characters — minimum 10 required
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={labelStyle}>City (Optional)</label>
                        <input
                          type="text" name="city"
                          value={formState.city}
                          onChange={handleChange}
                          style={fieldStyle}
                          placeholder="City name only"
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>District (Optional)</label>
                        <input
                          type="text" name="district"
                          value={formState.district}
                          onChange={handleChange}
                          style={fieldStyle}
                          placeholder="District name only"
                        />
                      </div>
                    </div>

                    {/* Location Consent */}
                    <div style={{
                      background: 'rgba(0,229,204,0.04)',
                      border: '1px solid rgba(0,229,204,0.15)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          name="locationConsent"
                          checked={formState.locationConsent}
                          onChange={handleChange}
                          style={{
                            marginTop: '2px',
                            width: '18px', height: '18px',
                            accentColor: '#00e5cc',
                            flexShrink: 0
                          }}
                        />
                        <span>
                          <span style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                            Share approximate location with authorities?
                          </span>
                          <span style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.5' }}>
                            Only city or district is stored. No GPS, no street address.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px' }}>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={!canProceedStep1()}
                      className="button-primary"
                      style={{ padding: '13px 32px', fontSize: '14px' }}
                    >
                      Next: Evidence →
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Step 2: Evidence Upload ─── */}
              {step === 2 && (
                <div className="animate-fadeIn">
                  <p className="eyebrow" style={{ marginBottom: '8px' }}>Step 2 of 3</p>
                  <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                    Upload Evidence
                  </h2>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '28px' }}>
                    Optional. Images or video evidence help authorities respond faster.
                  </p>

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
                    <input
                      type="file"
                      name="media"
                      accept={acceptedFileTypes}
                      onChange={handleFileChange}
                      style={{
                        position: 'absolute', inset: 0,
                        opacity: 0, cursor: 'pointer',
                        width: '100%', height: '100%'
                      }}
                    />
                    {formState.media ? (
                      <>
                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>📎</div>
                        <p style={{ fontSize: '15px', fontWeight: '600', color: '#00e5cc', marginBottom: '4px' }}>
                          {formState.media.name}
                        </p>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                          {(formState.media.size / 1024 / 1024).toFixed(2)} MB — Click to change
                        </p>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.5 }}>📁</div>
                        <p style={{ fontSize: '15px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                          Drop file here or click to upload
                        </p>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                          PNG, JPG, WEBP, GIF, MP4, WEBM, MOV — max 30MB
                        </p>
                      </>
                    )}
                  </div>

                  {/* Privacy notice */}
                  <div style={{
                    background: 'rgba(124,58,237,0.06)',
                    border: '1px solid rgba(124,58,237,0.2)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    marginBottom: '28px'
                  }}>
                    <p style={{ fontSize: '12px', color: 'rgba(200,180,255,0.8)', lineHeight: '1.5', margin: 0 }}>
                      🔒 <strong>Metadata Sanitization:</strong> All EXIF data (GPS, camera model, date/time) is automatically stripped from uploaded files before storage. AES-256 encryption applied.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                    <button type="button" onClick={() => setStep(1)} className="button-ghost" style={{ padding: '12px 24px' }}>
                      ← Back
                    </button>
                    <button type="button" onClick={() => setStep(3)} className="button-primary" style={{ padding: '13px 32px', fontSize: '14px' }}>
                      Next: Review →
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Step 3: Review & Submit ─── */}
              {step === 3 && (
                <div className="animate-fadeIn">
                  <p className="eyebrow" style={{ marginBottom: '8px' }}>Step 3 of 3</p>
                  <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                    Review & Submit
                  </h2>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '28px' }}>
                    Confirm your report details before anonymous submission.
                  </p>

                  {/* Summary */}
                  <div style={{
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    marginBottom: '24px'
                  }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <p style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Incident Description
                      </p>
                      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6' }}>
                        {formState.description.slice(0, 200)}{formState.description.length > 200 ? '...' : ''}
                      </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '16px 20px', gap: '16px' }}>
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '4px' }}>Location</p>
                        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                          {formState.city || formState.district ? `${formState.city} ${formState.district}`.trim() : 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '4px' }}>Consent</p>
                        <p style={{ fontSize: '13px', color: formState.locationConsent ? '#00e5cc' : 'rgba(255,255,255,0.4)' }}>
                          {formState.locationConsent ? 'Granted' : 'Not granted'}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '4px' }}>Evidence</p>
                        <p style={{ fontSize: '13px', color: formState.media ? '#00e5cc' : 'rgba(255,255,255,0.4)' }}>
                          {formState.media ? '1 file attached' : 'None'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Final security notice */}
                  <div className="alert-success" style={{ marginBottom: '24px' }}>
                    🛡️ This submission is fully anonymous. No IP, no identity, no exact location is stored. An encrypted anonymous ID will be generated for case tracking.
                  </div>

                  {/* Honeypot */}
                  <input
                    type="text" name="website"
                    value={formState.website}
                    onChange={handleChange}
                    tabIndex="-1"
                    autoComplete="off"
                    style={{ display: 'none' }}
                    aria-hidden="true"
                  />

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" onClick={() => setStep(2)} className="button-ghost" style={{ padding: '13px 24px' }}>
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="button-primary"
                      style={{ flex: 1, padding: '14px', fontSize: '15px' }}
                    >
                      {isSubmitting ? '⏳ Encrypting & Submitting...' : '🛡️ Submit Anonymously'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
