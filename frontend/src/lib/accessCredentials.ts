// keep in sync with backend CODE_TTL_MINUTES (default 30)
const CODE_TTL_MINUTES = Number(import.meta.env.VITE_CODE_TTL_MINUTES) || 30;
export const ACCESS_CODE_TTL_MS = CODE_TTL_MINUTES * 60 * 1000;
const STORAGE_KEY = 'access-credentials';
export const ACCESS_CREDENTIALS_CLEARED_EVENT = 'access-credentials-cleared';

export type AccessCredentials = {
  email: string;
  code: string;
};

type StoredAccessCredentials = AccessCredentials & {
  verifiedAt: number;
};

export function getAccessCredentials(): AccessCredentials | null {
  const stored = readStored();
  if (!stored) {
    return null;
  }
  if (isExpired(stored.verifiedAt)) {
    clearAccessCredentials();
    return null;
  }
  return { email: stored.email, code: stored.code };
}

export function setAccessCredentials(credentials: AccessCredentials): void {
  const stored: StoredAccessCredentials = {
    ...credentials,
    verifiedAt: Date.now(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function clearAccessCredentials(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(ACCESS_CREDENTIALS_CLEARED_EVENT));
}

export function getAccessCredentialsExpiresAt(): number | null {
  const stored = readStored();
  if (!stored || isExpired(stored.verifiedAt)) {
    return null;
  }
  return stored.verifiedAt + ACCESS_CODE_TTL_MS;
}

export function authHeaders(
  credentials?: AccessCredentials | null,
): Record<string, string> {
  const { email, code } = credentials ?? getAccessCredentials() ?? {};
  if (!email || !code) {
    return {};
  }
  return {
    'x-access-email': email,
    'x-access-code': code,
  };
}

function readStored(): StoredAccessCredentials | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAccessCredentials>;
    if (
      !parsed.email ||
      !parsed.code ||
      typeof parsed.verifiedAt !== 'number'
    ) {
      clearAccessCredentials();
      return null;
    }
    return parsed as StoredAccessCredentials;
  } catch {
    clearAccessCredentials();
    return null;
  }
}

function isExpired(verifiedAt: number): boolean {
  return Date.now() - verifiedAt >= ACCESS_CODE_TTL_MS;
}
