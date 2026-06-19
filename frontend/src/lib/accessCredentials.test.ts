import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_CODE_TTL_MS,
  getAccessCredentials,
  getAccessCredentialsExpiresAt,
  setAccessCredentials,
} from './accessCredentials';

describe('accessCredentials', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-19T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns credentials while session is within TTL', () => {
    setAccessCredentials({ email: 'user@example.com', code: '123456' });

    vi.setSystemTime(new Date('2026-06-19T10:29:59.000Z'));

    expect(getAccessCredentials()).toEqual({
      email: 'user@example.com',
      code: '123456',
    });
    expect(getAccessCredentialsExpiresAt()).toBe(
      new Date('2026-06-19T10:00:00.000Z').getTime() + ACCESS_CODE_TTL_MS,
    );
  });

  it('clears expired credentials', () => {
    setAccessCredentials({ email: 'user@example.com', code: '123456' });

    vi.setSystemTime(new Date(Date.now() + ACCESS_CODE_TTL_MS + 1));

    expect(getAccessCredentials()).toBeNull();
    expect(sessionStorage.getItem('access-credentials')).toBeNull();
  });

  it('clears legacy credentials without verifiedAt', () => {
    sessionStorage.setItem(
      'access-credentials',
      JSON.stringify({ email: 'user@example.com', code: '123456' }),
    );

    expect(getAccessCredentials()).toBeNull();
  });
});
