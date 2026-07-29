import { useEffect, useRef } from 'react';

export function AccessibleDialog({ title, children, onClose, initialFocusRef }) {
  const dialogRef = useRef(null);
  const priorFocusRef = useRef(null);

  useEffect(() => {
    priorFocusRef.current = document.activeElement;
    (initialFocusRef?.current || dialogRef.current?.querySelector('button, input, select, textarea'))?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      priorFocusRef.current?.focus?.();
    };
  }, [initialFocusRef, onClose]);

  return (
    <div className="dialog-backdrop">
      <section ref={dialogRef} role="alertdialog" aria-modal="true"
        aria-labelledby="safety-dialog-title" className="accessible-dialog">
        <h2 id="safety-dialog-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}
