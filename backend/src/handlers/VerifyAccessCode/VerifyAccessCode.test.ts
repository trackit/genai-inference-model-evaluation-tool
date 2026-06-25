import { register, reset } from '@trackit.io/di-container';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BasicError, BasicErrorType } from '../../errors';
import { tokenVerifyAccessCodeUseCase } from '../../useCases/VerifyAccessCode/VerifyAccessCodeUseCase';

describe('VerifyAccessCode Handler', () => {
  const verify = vi.fn();

  beforeEach(() => {
    reset();
    vi.clearAllMocks();
    register(tokenVerifyAccessCodeUseCase, {
      useValue: { verify },
    });
  });

  it('should return 200 when verification succeeds', async () => {
    const { handler } = await import('./VerifyAccessCode');
    const expiresAt = new Date();
    verify.mockResolvedValue({ expiresAt });
    const result = await handler(
      createEvent({ email: 'user@example.com', code: '123456' }),
    );
    const response = asResponse(result);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      data: { valid: true, expiresAt: expiresAt.toISOString() },
    });
    expect(verify).toHaveBeenCalledWith('user@example.com', '123456');
  });

  it('should return 403 for invalid code', async () => {
    const { handler } = await import('./VerifyAccessCode');
    verify.mockRejectedValue(
      new BasicError(
        BasicErrorType.FORBIDDEN,
        'INVALID_CODE',
        'Verification code is invalid or expired',
      ),
    );
    const result = await handler(
      createEvent({ email: 'user@example.com', code: '000000' }),
    );
    const response = asResponse(result);

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toMatchObject({
      success: false,
      error: { code: 'INVALID_CODE' },
    });
  });
});

function createEvent(body: Record<string, unknown>): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /auth/verify-code',
    rawPath: '/auth/verify-code',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    isBase64Encoded: false,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'POST',
        path: '/auth/verify-code',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-request-id',
      routeKey: 'POST /auth/verify-code',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
  };
}

function asResponse(result: unknown): { statusCode: number; body: string } {
  return result as { statusCode: number; body: string };
}
