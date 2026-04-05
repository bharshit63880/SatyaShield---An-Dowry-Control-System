import { startTransition, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formState, setFormState] = useState({
    email: '',
    password: ''
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const destination = location.state?.from ?? '/dashboard';

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormState((currentState) => ({
      ...currentState,
      [name]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await login(formState);
      startTransition(() => {
        navigate(destination, { replace: true });
      });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      <section className="surface-panel overflow-hidden">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="bg-[linear-gradient(180deg,#10203f_0%,#132d58_60%,#17376b_100%)] p-8 text-white sm:p-10 lg:p-12">
            <p className="eyebrow !text-trust-200">Restricted workspace</p>
            <h1 className="mt-4 font-display text-4xl tracking-[-0.04em] sm:text-5xl">
              Premium admin access for a privacy-first operations team.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-brand-100">
              Sign in with your configured admin credentials to access complaint review,
              notifications, analytics, and routing intelligence.
            </p>

            <div className="mt-8 grid gap-3">
              {[
                'Role-protected JWT authentication',
                'Live complaint alerts and risk visibility',
                'NGO routing and consent-based location insight'
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-brand-100">
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.06] p-5 text-sm leading-7 text-brand-100">
              The backend seeds the initial admin account from environment variables on first boot,
              so credentials stay operationally controlled instead of being hardcoded into the UI.
            </div>
          </div>

          <div className="bg-white p-8 sm:p-10 lg:p-12">
            <p className="eyebrow">Admin sign in</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-brand-950">
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-6 text-brand-600">
              Use the seeded admin account to enter the dashboard.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-brand-800">Email</span>
                <input
                  required
                  type="email"
                  name="email"
                  value={formState.email}
                  onChange={handleChange}
                  className="field-input"
                  placeholder="admin@example.com"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-brand-800">Password</span>
                <input
                  required
                  type="password"
                  name="password"
                  value={formState.password}
                  onChange={handleChange}
                  className="field-input"
                  placeholder="Enter your password"
                />
              </label>

              {errorMessage ? (
                <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'Signing in...' : 'Login to dashboard'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
