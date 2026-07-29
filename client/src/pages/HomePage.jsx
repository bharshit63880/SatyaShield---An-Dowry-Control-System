import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// Animated counter hook
function useCountUp(target, duration = 2000, suffix = '') {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count.toLocaleString() + suffix;
}

const stats = [
  { value: 12400, suffix: '+', label: 'Reports Filed', icon: '📋' },
  { value: 94, suffix: '.8%', label: 'Success Rate', icon: '✅' },
  { value: 15, suffix: 'min', label: 'Avg Response', icon: '⚡' },
  { value: 847, suffix: '+', label: 'NGO Partners', icon: '🤝' }
];

const features = [
  {
    icon: '🔐',
    title: 'Military-Grade Anonymity',
    desc: 'Zero PII collection. Your identity is never stored, logged, or associated with reports.',
    color: '#00e5cc'
  },
  {
    icon: '🧠',
    title: 'AI Risk Assessment',
    desc: 'Real-time severity scoring using NLP to prioritize critical cases instantly.',
    color: '#7c3aed'
  },
  {
    icon: '🗺️',
    title: 'Smart NGO Routing',
    desc: 'Complaints auto-routed to verified NGOs within your district for rapid response.',
    color: '#3b82f6'
  },
  {
    icon: '🔒',
    title: 'Encrypted Evidence Vault',
    desc: 'Accepted evidence is encrypted before being placed in private storage.',
    color: '#f59e0b'
  },
  {
    icon: '📡',
    title: 'Live Case Tracking',
    desc: 'Anonymous ID-based tracking. Monitor your case status in real-time.',
    color: '#10b981'
  },
  {
    icon: '⚖️',
    title: 'Legal Dispatch Integration',
    desc: 'Direct escalation channel to law enforcement and magistrate offices.',
    color: '#ef4444'
  }
];

const ngoStatuses = [
  { name: 'Mahila Shakti Foundation', district: 'Patna, Bihar', status: 'ONLINE', cases: 14 },
  { name: 'Nari Suraksha Samiti', district: 'Lucknow, UP', status: 'ONLINE', cases: 8 },
  { name: 'Jagori Helpline', district: 'Delhi NCR', status: 'STANDBY', cases: 3 },
  { name: 'Saheli Support Center', district: 'Jaipur, Rajasthan', status: 'ONLINE', cases: 22 },
];

function StatCard({ value, suffix, label, icon }) {
  const displayed = useCountUp(value, 2000, suffix);
  return (
    <div className="stat-card text-center animate-countUp">
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
      <div style={{
        fontSize: '36px',
        fontWeight: '800',
        background: 'linear-gradient(135deg, #00e5cc, #7c3aed)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        lineHeight: 1.1
      }}>
        {displayed}
      </div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '6px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

export function HomePage() {
  const [trackingId, setTrackingId] = useState('');
  const navigate = useNavigate();

  function handleSearch(e) {
    e.preventDefault();
    if (trackingId.trim()) {
      navigate('/track', { state: { caseId: trackingId.trim() } });
    }
  }

  return (
    <div className="page-shell py-8 sm:py-12">

      {/* ─── Hero Section ─── */}
      <section className="animate-rise" style={{ marginBottom: '40px' }}>
        <div
          className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10"
          style={{ alignItems: 'center' }}
        >
          {/* Left */}
          <div>


            <h1 style={{
              fontSize: 'clamp(36px, 6vw, 72px)',
              fontWeight: '900',
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              color: '#ffffff',
              marginBottom: '24px'
            }}>
              Your Silence <br />
              <span style={{
                background: 'linear-gradient(135deg, #00e5cc 0%, #00b8a3 40%, #7c3aed 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Ends Here.
              </span>
            </h1>

            <p style={{
              fontSize: '18px',
              lineHeight: '1.7',
              color: 'rgba(255,255,255,0.55)',
              maxWidth: '560px',
              marginBottom: '32px'
            }}>
              Identity-minimized reporting for dowry harassment concerns, with private case access and no guaranteed response time.
            </p>

            {/* CTA Buttons */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '36px' }}>
              <Link to="/report" className="button-primary" style={{ fontSize: '15px', padding: '14px 32px' }}>
                🛡️ Report Anonymously
              </Link>
              <Link to="/login" className="button-secondary" style={{ fontSize: '15px', padding: '13px 28px' }}>
                ⚙️ Operator Portal
              </Link>
            </div>

            {/* Tracking search */}
            <div style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '16px',
              maxWidth: '520px'
            }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '10px' }}>
                🔍 Track Your Case
              </p>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
                <input
                  required
                  type="text"
                  placeholder="Enter Anonymous Case ID (e.g. anon-xxxxx)"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  className="field-input"
                  style={{ flex: 1, fontSize: '13px', padding: '10px 14px' }}
                />
                <button type="submit" className="button-primary" style={{ padding: '10px 20px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                  Track →
                </button>
              </form>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '8px' }}>
                Enter your anonymous tracking reference ID to view timeline & encrypted chat
              </p>
            </div>
          </div>

          {/* Right — Live Ops Panel */}
          <div className="animate-fadeIn" style={{ animationDelay: '200ms' }}>
            {/* NGO Network Status */}
            <div className="cyber-card" style={{ padding: '24px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: '700', color: '#00e5cc', letterSpacing: '0.25em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                    🛰️ NGO Network Status
                  </p>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Live partner activity</p>
                </div>
                <div className="badge-active">
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', display: 'inline-block', animation: 'pulse-ring 2s infinite' }}></span>
                  LIVE
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ngoStatuses.map((ngo) => (
                  <div key={ngo.name} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '10px 14px'
                  }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.85)', margin: '0 0 2px' }}>{ngo.name}</p>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>{ngo.district}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '10px', fontWeight: '700',
                        color: ngo.status === 'ONLINE' ? '#00ff88' : '#fbbf24',
                        letterSpacing: '0.1em',
                        marginBottom: '2px'
                      }}>
                        ● {ngo.status}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{ngo.cases} cases</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick security facts */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,229,204,0.06) 0%, rgba(124,58,237,0.06) 100%)',
              border: '1px solid rgba(0,229,204,0.15)',
              borderRadius: '16px',
              padding: '20px'
            }}>
              <p style={{ fontSize: '10px', fontWeight: '700', color: '#00e5cc', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '14px' }}>
                🔒 Military-Grade Anonymity
              </p>
              {[
                'Zero PII fields collected',
                'Encrypted private evidence storage',
                'AES-256 encryption at rest',
                'Approximate region routing only'
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                  <span style={{ color: '#00e5cc', fontSize: '12px' }}>✓</span>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats Section ─── */}
      <section style={{ marginBottom: '60px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px'
        }} className="sm:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section style={{ marginBottom: '60px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p className="eyebrow" style={{ marginBottom: '12px' }}>Platform Capabilities</p>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 48px)',
            fontWeight: '800',
            color: '#fff',
            letterSpacing: '-0.03em',
            margin: '0 0 16px'
          }}>
            Built for Maximum Protection
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.45)', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
            Every feature engineered to protect the most vulnerable. No compromises.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(1, 1fr)',
          gap: '16px'
        }} className="sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="cyber-card"
              style={{ padding: '28px', animationDelay: `${i * 80}ms` }}
            >
              <div style={{
                width: '52px', height: '52px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${f.color}15`,
                border: `1px solid ${f.color}30`,
                borderRadius: '14px',
                fontSize: '24px',
                marginBottom: '16px',
                boxShadow: `0 0 20px ${f.color}10`
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section style={{ marginBottom: '20px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,229,204,0.08) 0%, rgba(124,58,237,0.08) 100%)',
          border: '1px solid rgba(0,229,204,0.2)',
          borderRadius: '24px',
          padding: '48px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Background glow */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '400px', height: '200px',
            background: 'radial-gradient(ellipse, rgba(0,229,204,0.1) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          <p className="eyebrow" style={{ marginBottom: '16px' }}>Take Action Now</p>
          <h2 style={{
            fontSize: 'clamp(24px, 4vw, 42px)',
            fontWeight: '800',
            color: '#fff',
            letterSpacing: '-0.03em',
            marginBottom: '16px'
          }}>
            You Are Not Alone.
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', maxWidth: '440px', margin: '0 auto 32px', lineHeight: '1.6' }}>
            File an identity-minimized report when it is safe to do so. This platform is not an emergency service.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/report" className="button-primary" style={{ fontSize: '15px', padding: '14px 36px' }}>
              🛡️ File Report Now
            </Link>
            <a href="tel:1800-112-1090" className="button-secondary" style={{ fontSize: '15px', padding: '13px 28px' }}>
              📞 Emergency Helpline
            </a>
          </div>

          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginTop: '24px' }}>
            National Women Helpline: 1800-112-1090 | Available 24/7 | Free of charge
          </p>
        </div>
      </section>

    </div>
  );
}
