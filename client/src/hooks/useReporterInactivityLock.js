import { useCallback, useEffect, useRef, useState } from 'react';
import { REPORTER_LOCK_EVENT } from '../services/quick-exit';

const timeoutMs = Math.max(60_000,
  Number(import.meta.env.VITE_REPORTER_INACTIVITY_SECONDS || 900) * 1000);
const warningMs = Math.min(timeoutMs - 10_000,
  Number(import.meta.env.VITE_REPORTER_LOCK_WARNING_SECONDS || 60) * 1000);

export function useReporterInactivityLock({ active, onLock }) {
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const deadlineRef = useRef(0);
  const warningTimerRef = useRef();
  const lockTimerRef = useRef();
  const intervalRef = useRef();

  const clearTimers = useCallback(() => {
    clearTimeout(warningTimerRef.current);
    clearTimeout(lockTimerRef.current);
    clearInterval(intervalRef.current);
  }, []);

  const lock = useCallback(() => {
    clearTimers();
    setSecondsRemaining(null);
    onLock();
  }, [clearTimers, onLock]);

  const reset = useCallback(() => {
    if (!active) return;
    clearTimers();
    setSecondsRemaining(null);
    deadlineRef.current = Date.now() + timeoutMs;
    warningTimerRef.current = setTimeout(() => {
      setSecondsRemaining(Math.ceil(warningMs / 1000));
      intervalRef.current = setInterval(() => {
        setSecondsRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
      }, 1000);
    }, timeoutMs - warningMs);
    lockTimerRef.current = setTimeout(lock, timeoutMs);
  }, [active, clearTimers, lock]);

  useEffect(() => {
    if (!active) {
      clearTimers();
      setSecondsRemaining(null);
      return undefined;
    }
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    const onSafetyEvent = () => lock();
    window.addEventListener(REPORTER_LOCK_EVENT, onSafetyEvent);
    let channel;
    try {
      channel = new BroadcastChannel('satyashield-reporter-safety');
      channel.onmessage = ({ data }) => {
        if (data?.type === 'quick-exit' || data?.type === 'lock') lock();
      };
    } catch {
      channel = null;
    }
    reset();
    return () => {
      clearTimers();
      events.forEach((event) => window.removeEventListener(event, reset));
      window.removeEventListener(REPORTER_LOCK_EVENT, onSafetyEvent);
      channel?.close();
    };
  }, [active, clearTimers, lock, reset]);

  const lockAllTabs = useCallback(() => {
    try {
      const channel = new BroadcastChannel('satyashield-reporter-safety');
      channel.postMessage({ type: 'lock' });
      channel.close();
    } catch {
      // Current tab still locks.
    }
    lock();
  }, [lock]);

  return { secondsRemaining, continueSession: reset, lockNow: lockAllTabs };
}
