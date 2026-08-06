import { register, reset } from '@trackit.io/di-container';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenGetPreprocessingStatusUseCase } from '../../useCases/GetPreprocessingStatus/GetPreprocessingStatusUseCase';

describe('GetPreprocessingStatus Handler', () => {
  const execute = vi.fn();

  beforeEach(() => {
    reset();
    vi.clearAllMocks();
    register(tokenGetPreprocessingStatusUseCase, { useValue: { execute } });
  });

  it('returns 200 with the mapped state', async () => {
    const { handler } = await import('./GetPreprocessingStatus');
    execute.mockResolvedValue({
      state: 'COMPLETED',
      structuredDatasetArtifactKey: 'datasets/ds1/ds1.jsonl',
      sampleCount: 3,
    });

    const result = await handler(
      createEvent('ds1', { executionArn: 'arn:exec:1' }),
    );
    const response = result as { statusCode: number; body: string };

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      data: {
        state: 'COMPLETED',
        structuredDatasetArtifactKey: 'datasets/ds1/ds1.jsonl',
        sampleCount: 3,
      },
    });
    expect(execute).toHaveBeenCalledWith({ executionArn: 'arn:exec:1' });
  });

  it('returns 400 when executionArn is missing', async () => {
    const { handler } = await import('./GetPreprocessingStatus');

    const result = await handler(createEvent('ds1', undefined));
    const response = result as { statusCode: number };

    expect(response.statusCode).toBe(400);
  });
});

function createEvent(
  datasetId: string,
  query: Record<string, string> | undefined,
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /datasets/{datasetId}/preprocess/status',
    rawPath: `/datasets/${datasetId}/preprocess/status`,
    rawQueryString: '',
    headers: {},
    isBase64Encoded: false,
    pathParameters: { datasetId },
    queryStringParameters: query,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'GET',
        path: `/datasets/${datasetId}/preprocess/status`,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-request-id',
      routeKey: 'GET /datasets/{datasetId}/preprocess/status',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
  } as APIGatewayProxyEventV2;
}
