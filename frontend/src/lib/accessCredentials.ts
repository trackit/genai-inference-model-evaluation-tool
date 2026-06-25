const STORAGE_KEY = 'access-credentials';
export const ACCESS_CREDENTIALS_CLEARED_EVENT = 'access-credentials-cleared';

export type AccessCredentials = {
  email: string;
  code: string;
  expiresAt: number;
};

export function getAccessCredentials(): Omit<
  AccessCredentials,
  'expiresAt'
> | null {
  const stored = readStored();
  if (!stored) {
    return null;
  }
  if (isExpired(stored.expiresAt)) {
    clearAccessCredentials();
    return null;
  }
  return { email: stored.email, code: stored.code };
}

export function setAccessCredentials(credentials: AccessCredentials): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

export function clearAccessCredentials(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(ACCESS_CREDENTIALS_CLEARED_EVENT));
}

export function getAccessCredentialsExpiresAt(): number | null {
  const stored = readStored();
  if (!stored || isExpired(stored.expiresAt)) {
    return null;
  }
  return stored.expiresAt;
}

export function authHeaders(
  credentials?: Pick<AccessCredentials, 'email' | 'code'> | null,
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

function readStored(): AccessCredentials | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AccessCredentials>;
    if (
      !parsed.email ||
      !parsed.code ||
      typeof parsed.expiresAt !== 'number' ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      clearAccessCredentials();
      return null;
    }
    return parsed as AccessCredentials;
  } catch {
    clearAccessCredentials();
    return null;
  }
}

function isExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt;
}
