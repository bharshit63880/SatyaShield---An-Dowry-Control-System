import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="page-shell py-10">
      <section className="surface-panel flex min-h-[70vh] flex-col items-center justify-center px-6 py-12 text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-4 font-display text-5xl tracking-[-0.04em] text-brand-950 sm:text-6xl">
          This route stepped out of the product.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-8 text-brand-600">
          The page you requested is not part of the current experience. Return to the home page or
          continue into the admin workspace.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className="button-primary">
            Back home
          </Link>
          <Link to="/login" className="button-secondary">
            Login
          </Link>
        </div>
      </section>
    </div>
  );
}
