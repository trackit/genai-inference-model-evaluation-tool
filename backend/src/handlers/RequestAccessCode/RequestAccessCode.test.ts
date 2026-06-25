import { register, reset } from '@trackit.io/di-container';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BasicError, BasicErrorType } from '../../errors';
import { tokenRequestAccessCodeUseCase } from '../../useCases/RequestAccessCode/RequestAccessCodeUseCase';

describe('RequestAccessCode Handler', () => {
  const execute = vi.fn();

  beforeEach(() => {
    reset();
    vi.clearAllMocks();
    register(tokenRequestAccessCodeUseCase, {
      useValue: { execute },
    });
  });

  it('should return 202 when code request succeeds', async () => {
    const { handler } = await import('./RequestAccessCode');
    execute.mockResolvedValue(undefined);
    const result = await handler(createEvent({ email: 'user@example.com' }));
    const response = asResponse(result);

    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      data: { message: 'Code request accepted' },
    });
    expect(execute).toHaveBeenCalledWith('user@example.com');
  });

  it('should return 400 for bad request errors', async () => {
    const { handler } = await import('./RequestAccessCode');
    execute.mockRejectedValue(
      new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_EMAIL',
        'Email must be a valid email address',
      ),
    );
    const result = await handler(createEvent({ email: 'bad-email' }));
    const response = asResponse(result);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({
      success: false,
      error: { code: 'INVALID_EMAIL' },
    });
  });
});

function createEvent(body: Record<string, unknown>): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /auth/request-code',
    rawPath: '/auth/request-code',
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
        path: '/auth/request-code',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-request-id',
      routeKey: 'POST /auth/request-code',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
  };
}

function asResponse(result: unknown): { statusCode: number; body: string } {
  return result as { statusCode: number; body: string };
}
