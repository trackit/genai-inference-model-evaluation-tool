import { register, reset } from '@trackit.io/di-container';
import type { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenVerifyAccessCodeUseCase } from '../../useCases/VerifyAccessCode/VerifyAccessCodeUseCase';

describe('AccessCodeAuthorizer', () => {
  const verify = vi.fn();

  beforeEach(() => {
    reset();
    vi.clearAllMocks();
    register(tokenVerifyAccessCodeUseCase, {
      useValue: { verify },
    });
  });

  it('should authorize when headers are valid', async () => {
    verify.mockResolvedValue(undefined);
    const { handler } = await import('./AccessCodeAuthorizer');

    const result = await handler(
      createEvent({
        'x-access-email': 'user@example.com',
        'x-access-code': '123456',
      }),
    );

    expect(result).toEqual({ isAuthorized: true });
    expect(verify).toHaveBeenCalledWith('user@example.com', '123456');
  });

  it('should deny when headers are missing', async () => {
    const { handler } = await import('./AccessCodeAuthorizer');

    const result = await handler(createEvent({}));

    expect(result).toEqual({ isAuthorized: false });
    expect(verify).not.toHaveBeenCalled();
  });

  it('should deny when verification fails', async () => {
    verify.mockRejectedValue(new Error('invalid'));
    const { handler } = await import('./AccessCodeAuthorizer');

    const result = await handler(
      createEvent({
        'x-access-email': 'user@example.com',
        'x-access-code': '000000',
      }),
    );

    expect(result).toEqual({ isAuthorized: false });
  });
});

function createEvent(
  headers: Record<string, string>,
): APIGatewayRequestAuthorizerEventV2 {
  return {
    version: '2.0',
    type: 'REQUEST',
    routeArn:
      'arn:aws:execute-api:us-east-1:123456789012:api/$default/POST/datasets',
    identitySource: [],
    routeKey: 'POST /datasets',
    rawPath: '/datasets',
    rawQueryString: '',
    headers,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api',
      domainName: 'api.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'api',
      http: {
        method: 'POST',
        path: '/datasets',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request-id',
      routeKey: 'POST /datasets',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
  };
}
