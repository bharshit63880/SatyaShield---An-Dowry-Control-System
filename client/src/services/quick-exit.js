export const QUICK_EXIT_EVENT = 'satyashield:quick-exit';
export const REPORTER_LOCK_EVENT = 'satyashield:reporter-lock';
export const NEUTRAL_EXIT_URL = import.meta.env.VITE_QUICK_EXIT_URL || 'https://www.google.com/';

export function performQuickExit() {
  window.dispatchEvent(new Event(QUICK_EXIT_EVENT));
  window.dispatchEvent(new Event(REPORTER_LOCK_EVENT));
  try {
    const channel = new BroadcastChannel('satyashield-reporter-safety');
    channel.postMessage({ type: 'quick-exit' });
    channel.close();
  } catch {
    // The current tab is still cleared when BroadcastChannel is unavailable.
  }
  window.location.replace(NEUTRAL_EXIT_URL);
}
