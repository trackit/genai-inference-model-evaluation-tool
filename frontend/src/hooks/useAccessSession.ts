import {
  ACCESS_CREDENTIALS_CLEARED_EVENT,
  clearAccessCredentials,
  getAccessCredentials,
  getAccessCredentialsExpiresAt,
  setAccessCredentials,
} from '@/lib/accessCredentials';
import { verifyAccessCode } from '@/services/apiService';
import { useCallback, useEffect, useState } from 'react';

type AccessSessionState = 'checking' | 'authenticated' | 'unauthenticated';

export function useAccessSession() {
  const [state, setState] = useState<AccessSessionState>('checking');

  const signOut = useCallback(() => {
    clearAccessCredentials();
    setState('unauthenticated');
  }, []);

  const signIn = useCallback((email: string, code: string) => {
    setAccessCredentials({ email, code });
    setState('authenticated');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function validateSession() {
      const credentials = getAccessCredentials();
      if (!credentials) {
        if (!cancelled) {
          setState('unauthenticated');
        }
        return;
      }

      try {
        await verifyAccessCode(credentials.email, credentials.code);
        if (!cancelled) {
          setState('authenticated');
        }
      } catch {
        clearAccessCredentials();
        if (!cancelled) {
          setState('unauthenticated');
        }
      }
    }

    void validateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state !== 'authenticated') {
      return;
    }

    const expiresAt = getAccessCredentialsExpiresAt();
    if (expiresAt === null || !Number.isFinite(expiresAt)) {
      clearAccessCredentials();
      queueMicrotask(() => setState('unauthenticated'));
      return;
    }

    const remainingMs = expiresAt - Date.now();
    const timer = window.setTimeout(() => {
      clearAccessCredentials();
      setState('unauthenticated');
    }, remainingMs);

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (!getAccessCredentials()) {
        setState('unauthenticated');
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [state]);

  useEffect(() => {
    const onCleared = () => {
      setState('unauthenticated');
    };

    window.addEventListener(ACCESS_CREDENTIALS_CLEARED_EVENT, onCleared);

    return () => {
      window.removeEventListener(ACCESS_CREDENTIALS_CLEARED_EVENT, onCleared);
    };
  }, []);

  return { state, signIn, signOut };
}
