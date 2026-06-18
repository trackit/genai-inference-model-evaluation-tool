const STORAGE_KEY = 'access-credentials';

export type AccessCredentials = {
  email: string;
  code: string;
};

export function getAccessCredentials(): AccessCredentials | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AccessCredentials;
    if (parsed.email && parsed.code) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setAccessCredentials(credentials: AccessCredentials): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

export function clearAccessCredentials(): void {
  sessionStorage.removeItem(STORAGE_KEY);
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
