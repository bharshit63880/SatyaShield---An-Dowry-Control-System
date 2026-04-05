import { startTransition, useState } from 'react';

import { submitComplaintRequest } from '../services/api';

const acceptedFileTypes = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime';

const initialFormState = {
  description: '',
  city: '',
  district: '',
  locationConsent: false,
  website: '',
  media: null
};

export function ComplaintPage() {
  const [formState, setFormState] = useState(initialFormState);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleDescriptionChange(event) {
    const { value } = event.target;
    setFormState((currentState) => ({
      ...currentState,
      description: value
    }));
  }

  function handleTextFieldChange(event) {
    const { name, value } = event.target;
    setFormState((currentState) => ({
      ...currentState,
      [name]: value
    }));
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    setFormState((currentState) => ({
      ...currentState,
      media: file
    }));
  }

  function handleConsentChange(event) {
    const { checked } = event.target;
    setFormState((currentState) => ({
      ...currentState,
      locationConsent: checked
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    setSuccessData(null);

    const payload = new FormData();
    payload.append('description', formState.description);
    payload.append('city', formState.city);
    payload.append('district', formState.district);
    payload.append('locationConsent', String(formState.locationConsent));
    payload.append('website', formState.website);

    if (formState.media) {
      payload.append('media', formState.media);
    }

    try {
      const response = await submitComplaintRequest(payload);

      startTransition(() => {
        setSuccessData(response.data.complaint);
        setFormState(initialFormState);
      });

      event.currentTarget.reset();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="surface-panel p-8 sm:p-10">
          <p className="eyebrow">Anonymous reporting</p>
          <h1 className="mt-4 font-display text-4xl tracking-[-0.04em] text-brand-950 sm:text-5xl">
            Built to feel safe before a reporter shares a single word.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-brand-600">
            No login. No exact GPS. No identity fields. Just a careful, modern reporting flow with
            consent-based location sharing and privacy-protected media intake.
          </p>

          <div className="mt-8 grid gap-3">
            {[
              'Automatic anonymous ID for every report',
              'Media privacy and metadata removal built into upload handling',
              'Approximate location only, shared only with consent',
              'AI-supported risk review, NGO routing, and admin notifications'
            ].map((item) => (
              <div key={item} className="rounded-[22px] border border-brand-100 bg-white px-4 py-4 text-sm leading-6 text-brand-700">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] border border-trust-200 bg-trust-50 px-5 py-5">
            <p className="text-sm font-semibold text-brand-950">Trust note</p>
            <p className="mt-2 text-sm leading-7 text-brand-600">
              Personal identity is intentionally not collected here. If you accidentally mention
              exact address, phone number, or GPS details, avoid attaching them unless legally
              necessary and safe.
            </p>
          </div>
        </section>

        <section className="surface-card p-8 sm:p-10">
          <p className="eyebrow">Complaint form</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-brand-950">
            Submit securely
          </h2>
          <p className="mt-2 text-sm leading-6 text-brand-600">
            Share as much or as little as you want. At least one of description or media must be
            provided.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-brand-800">Description</span>
              <textarea
                name="description"
                rows="6"
                value={formState.description}
                onChange={handleDescriptionChange}
                className="field-input min-h-[160px] resize-y"
                placeholder="Describe the complaint or incident"
              />
            </label>

            <input
              type="text"
              name="website"
              value={formState.website}
              onChange={handleTextFieldChange}
              tabIndex="-1"
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-brand-800">City</span>
                <input
                  type="text"
                  name="city"
                  value={formState.city}
                  onChange={handleTextFieldChange}
                  className="field-input"
                  placeholder="City only"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-brand-800">District</span>
                <input
                  type="text"
                  name="district"
                  value={formState.district}
                  onChange={handleTextFieldChange}
                  className="field-input"
                  placeholder="District only"
                />
              </label>
            </div>

            <div className="rounded-[24px] border border-brand-100 bg-brand-50 px-5 py-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={formState.locationConsent}
                  onChange={handleConsentChange}
                  className="mt-1 h-4 w-4 rounded border-brand-300 text-brand-900 focus:ring-brand-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-brand-950">
                    Share approximate location with authorities?
                  </span>
                  <span className="mt-1 block text-sm text-brand-700">
                    Only city or district is stored, never exact GPS or street-level details.
                  </span>
                </span>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-brand-800">Image or video</span>
              <input
                type="file"
                name="media"
                accept={acceptedFileTypes}
                onChange={handleFileChange}
                className="block w-full rounded-[22px] border border-dashed border-brand-200 bg-brand-50 px-4 py-4 text-sm text-brand-700 file:mr-4 file:rounded-full file:border-0 file:bg-brand-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-900"
              />
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-brand-500">
                Accepted: PNG, JPG, WEBP, GIF, MP4, WEBM, MOV up to 30MB
              </p>
              {formState.media ? (
                <p className="mt-2 text-sm text-brand-700">Selected: {formState.media.name}</p>
              ) : null}
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
              {isSubmitting ? 'Submitting complaint...' : 'Submit anonymously'}
            </button>
          </form>

          {successData ? (
            <div className="mt-6 rounded-[24px] border border-accent-200 bg-accent-50 px-5 py-5 text-brand-950">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-700">
                Complaint submitted
              </p>
              <p className="mt-3 text-sm">
                Anonymous ID: <span className="font-semibold">{successData.anonymousId}</span>
              </p>
              <p className="mt-2 text-sm">Status: {successData.status}</p>
              <p className="mt-2 text-sm">
                Approximate location:{' '}
                {successData.locationConsent && successData.approximateLocation
                  ? successData.approximateLocation
                  : 'Not shared'}
              </p>
              <p className="mt-2 text-sm">
                Timestamp: {new Date(successData.timestamp).toLocaleString()}
              </p>
              {successData.mediaUrl ? (
                <a
                  href={successData.mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-semibold text-brand-800 underline underline-offset-4"
                >
                  Open uploaded media
                </a>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
