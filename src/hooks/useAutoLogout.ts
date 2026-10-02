import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos exactos
const LAST_ACTIVITY_KEY = 'bee_last_activity_timestamp';

/**
 * Hook to automatically log out the user and return to the landing page
 * after 15 minutes of user inactivity (no mouse, keyboard, touch, scroll).
 */
export function useAutoLogout(
  isActive: boolean,
  onLogout: () => void
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteRef = useRef<number>(0);

  const resetTimer = useCallback((forceWrite = false) => {
    if (!isActive) return;

    const now = Date.now();
    if (forceWrite || now - lastWriteRef.current > 5000) {
      lastWriteRef.current = now;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
      } catch {
        // ignore storage errors
      }
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      onLogout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [isActive, onLogout]);

  useEffect(() => {
    if (!isActive) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      try {
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch {
        // ignore
      }
      return;
    }

    // Initialize fresh activity timestamp when entering active state so a stale
    // timestamp from a previous session never bounces the first click back to landing
    resetTimer(true);

    // Activity event listeners across DOM
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'wheel'
    ];

    const handleUserActivity = () => {
      resetTimer(false);
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Also check on window focus / visibilitychange
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        try {
          const savedTime = localStorage.getItem(LAST_ACTIVITY_KEY);
          if (savedTime) {
            const diff = Date.now() - parseInt(savedTime, 10);
            if (diff >= INACTIVITY_TIMEOUT_MS) {
              onLogout();
              return;
            }
          }
        } catch {
          // ignore
        }
        resetTimer(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, onLogout, resetTimer]);
}
