import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="page-shell py-8 sm:py-10">
      <section className="surface-panel overflow-hidden px-6 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-14">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="animate-rise">
            <div className="inline-flex items-center gap-3 rounded-full border border-accent-200 bg-accent-50 px-4 py-2 text-sm font-medium text-accent-700">
              <span className="h-2.5 w-2.5 rounded-full bg-accent-500" />
              Trusted complaint operations platform
            </div>

            <h1 className="mt-6 max-w-4xl font-display text-5xl leading-[1.03] tracking-[-0.05em] text-brand-950 sm:text-6xl lg:text-7xl">
              Built to earn trust from reporters and operators at the same time.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-brand-600 sm:text-lg">
              Premium complaint intake, privacy-first media handling, AI-assisted triage, NGO
              routing, analytics, and an admin workspace that feels like a serious funded product
              from day one.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/report" className="button-primary">
                Report anonymously
              </Link>
              <Link to="/dashboard" className="button-secondary">
                Explore dashboard
              </Link>
              <Link to="/login" className="button-secondary">
                Admin login
              </Link>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ['Private by default', 'Encrypted text, sanitized media, and approximate location only.'],
                ['Operator ready', 'Risk scoring, NGO routing, notifications, and analytics built in.'],
                ['Launch quality', 'Responsive design, modular architecture, and production-minded UX.']
              ].map(([title, copy]) => (
                <div key={title} className="rounded-[22px] border border-brand-100 bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,28,61,0.05)]">
                  <p className="text-sm font-semibold text-brand-950">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-brand-600">{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-rise [animation-delay:120ms]">
            <div className="rounded-[32px] border border-brand-100 bg-[linear-gradient(180deg,#14284f_0%,#10203f_52%,#0c1630_100%)] p-5 text-white shadow-float">
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-trust-200">
                      Live overview
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">Command center</h2>
                  </div>
                  <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                    Secure
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    ['Intake', 'Anonymous reporting with protected evidence uploads'],
                    ['Triage', 'Keyword risk scoring and priority visibility'],
                    ['Routing', 'Location-based NGO assignment structure'],
                    ['Response', 'Admin notifications, charts, and workflow controls']
                  ].map(([title, copy]) => (
                    <div
                      key={title}
                      className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4"
                    >
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="mt-2 text-sm leading-6 text-brand-200">{copy}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-[24px] border border-accent-300/20 bg-[linear-gradient(180deg,rgba(24,170,162,0.18),rgba(24,170,162,0.05))] p-5">
                  <p className="text-sm font-semibold text-white">Why this feels product-ready</p>
                  <p className="mt-2 text-sm leading-6 text-brand-100">
                    The system balances credibility, warmth, and operational precision across every
                    touchpoint instead of treating trust as a cosmetic layer.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
