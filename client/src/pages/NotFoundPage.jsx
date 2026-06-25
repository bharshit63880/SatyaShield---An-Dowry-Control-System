import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="page-shell py-10">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        textAlign: 'center'
      }}>
        {/* Glitch 404 */}
        <div style={{
          fontSize: 'clamp(80px, 15vw, 160px)',
          fontWeight: '900',
          letterSpacing: '-0.05em',
          lineHeight: 1,
          background: 'linear-gradient(135deg, rgba(0,229,204,0.5) 0%, rgba(124,58,237,0.5) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '8px',
          filter: 'drop-shadow(0 0 30px rgba(0,229,204,0.3))'
        }}>
          404
        </div>

        <p className="eyebrow" style={{ marginBottom: '16px' }}>Access Denied</p>

        <h1 style={{
          fontSize: 'clamp(22px, 3vw, 36px)',
          fontWeight: '800',
          color: '#fff',
          letterSpacing: '-0.03em',
          marginBottom: '16px',
          maxWidth: '500px'
        }}>
          This route stepped out of the system.
        </h1>

        <p style={{
          fontSize: '15px',
          color: 'rgba(255,255,255,0.4)',
          maxWidth: '460px',
          lineHeight: '1.7',
          marginBottom: '36px'
        }}>
          The page you requested is not part of the current experience. Return home or enter the operator workspace.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/" className="button-primary" style={{ padding: '13px 28px', fontSize: '14px' }}>
            ← Back Home
          </Link>
          <Link to="/login" className="button-secondary" style={{ padding: '12px 24px', fontSize: '14px' }}>
            Operator Login
          </Link>
        </div>

        {/* Terminal-style footer text */}
        <div style={{
          marginTop: '48px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '12px',
          color: 'rgba(0,229,204,0.3)',
          letterSpacing: '0.05em'
        }}>
          SatyaShield Security System — Route not found / Access logged
        </div>
      </div>
    </div>
  );
}
