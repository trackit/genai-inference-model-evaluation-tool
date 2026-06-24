import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAccessCredentials,
  getAccessCredentialsExpiresAt,
  setAccessCredentials,
} from './accessCredentials';

const NOW = new Date('2026-01-01T10:00:00.000Z');
const EXPIRES_AT = new Date('2026-01-01T10:30:00.000Z').getTime();

describe('accessCredentials', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns credentials while session is within expiry', () => {
    setAccessCredentials({
      email: 'user@example.com',
      code: '123456',
      expiresAt: EXPIRES_AT,
    });

    expect(getAccessCredentials()).toEqual({
      email: 'user@example.com',
      code: '123456',
    });
    expect(getAccessCredentialsExpiresAt()).toBe(EXPIRES_AT);
  });

  it('clears expired credentials', () => {
    setAccessCredentials({
      email: 'user@example.com',
      code: '123456',
      expiresAt: EXPIRES_AT,
    });

    vi.setSystemTime(new Date(EXPIRES_AT));

    expect(getAccessCredentials()).toBeNull();
    expect(sessionStorage.getItem('access-credentials')).toBeNull();
  });

  it('clears legacy credentials without expiresAt', () => {
    sessionStorage.setItem(
      'access-credentials',
      JSON.stringify({ email: 'user@example.com', code: '123456' }),
    );

    expect(getAccessCredentials()).toBeNull();
  });
});
