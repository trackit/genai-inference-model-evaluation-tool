import { register, reset } from '@trackit.io/di-container';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenStartPreprocessingUseCase } from '../../useCases/StartPreprocessing/StartPreprocessingUseCase';

describe('StartPreprocessing Handler', () => {
  const execute = vi.fn();

  beforeEach(() => {
    reset();
    vi.clearAllMocks();
    register(tokenStartPreprocessingUseCase, { useValue: { execute } });
  });

  it('returns 201 with the execution arn', async () => {
    const { handler } = await import('./StartPreprocessing');
    execute.mockResolvedValue({
      executionArn: 'arn:exec:1',
      status: 'RUNNING',
    });

    const result = await handler(
      createEvent('ds1', {
        taskType: 'summarization',
        chunkingStrategy: 'SECTION',
      }),
    );
    const response = result as { statusCode: number; body: string };

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      data: { executionArn: 'arn:exec:1', status: 'RUNNING' },
    });
    expect(execute).toHaveBeenCalledWith({
      datasetId: 'ds1',
      taskType: 'summarization',
      chunkingStrategy: 'SECTION',
    });
  });

  it('returns 422 for an invalid chunking strategy', async () => {
    const { handler } = await import('./StartPreprocessing');

    const result = await handler(
      createEvent('ds1', {
        taskType: 'summarization',
        chunkingStrategy: 'nope',
      }),
    );
    const response = result as { statusCode: number; body: string };

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body)).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });
});

function createEvent(
  datasetId: string,
  body: Record<string, unknown>,
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /datasets/{datasetId}/preprocess',
    rawPath: `/datasets/${datasetId}/preprocess`,
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    isBase64Encoded: false,
    pathParameters: { datasetId },
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'POST',
        path: `/datasets/${datasetId}/preprocess`,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-request-id',
      routeKey: 'POST /datasets/{datasetId}/preprocess',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
  } as APIGatewayProxyEventV2;
}
