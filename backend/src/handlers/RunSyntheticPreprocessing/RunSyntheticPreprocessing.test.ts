import { register, reset } from '@trackit.io/di-container';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BasicError, BasicErrorType } from '../../errors';
import { tokenRunSyntheticPreprocessingUseCase } from '../../useCases/RunSyntheticPreprocessing/RunSyntheticPreprocessingUseCase';

describe('RunSyntheticPreprocessing Handler', () => {
  const runSyntheticPreprocessing = vi.fn();

  beforeEach(() => {
    reset();
    vi.clearAllMocks();
    register(tokenRunSyntheticPreprocessingUseCase, {
      useValue: { runSyntheticPreprocessing },
    });
  });

  it('returns 201 when synthetic preprocessing succeeds', async () => {
    const { handler } = await import('./RunSyntheticPreprocessing');
    runSyntheticPreprocessing.mockResolvedValue({
      datasetId: 'demo-dataset',
      syntheticDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      structuredDatasetArtifactKey: 'datasets/demo-dataset/demo-dataset.jsonl',
      generatedCount: 2,
      failedCount: 0,
      sampleCount: 2,
    });

    const result = await handler(
      createEvent('demo-dataset', {
        convertedDatasetArtifactKey:
          'datasets/demo-dataset/demo-dataset-converted.jsonl',
        taskType: 'summarization',
        modelId: 'test-model',
      }),
    );
    const response = asResponse(result);

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      data: {
        datasetId: 'demo-dataset',
        syntheticDatasetArtifactKey:
          'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
        structuredDatasetArtifactKey:
          'datasets/demo-dataset/demo-dataset.jsonl',
        generatedCount: 2,
        failedCount: 0,
        sampleCount: 2,
      },
    });
    expect(runSyntheticPreprocessing).toHaveBeenCalledWith({
      datasetId: 'demo-dataset',
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      taskType: 'summarization',
      modelId: 'test-model',
    });
  });

  it('returns 422 for invalid body values', async () => {
    const { handler } = await import('./RunSyntheticPreprocessing');

    const result = await handler(
      createEvent('demo-dataset', {
        convertedDatasetArtifactKey: '',
        taskType: 'unsupported',
      }),
    );
    const response = asResponse(result);

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body)).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('maps use case BasicErrors to HTTP responses', async () => {
    const { handler } = await import('./RunSyntheticPreprocessing');
    runSyntheticPreprocessing.mockRejectedValue(
      new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'SYNTHETIC_GENERATION_FAILED',
        'Synthetic generation produced failed rows',
      ),
    );

    const result = await handler(
      createEvent('demo-dataset', {
        convertedDatasetArtifactKey:
          'datasets/demo-dataset/demo-dataset-converted.jsonl',
        taskType: 'classification',
      }),
    );
    const response = asResponse(result);

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body)).toMatchObject({
      success: false,
      error: { code: 'SYNTHETIC_GENERATION_FAILED' },
    });
  });
});

function createEvent(
  datasetId: string,
  body: Record<string, unknown>,
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /preprocessing/{datasetId}/synthetic',
    rawPath: `/preprocessing/${datasetId}/synthetic`,
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
        path: `/preprocessing/${datasetId}/synthetic`,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-request-id',
      routeKey: 'POST /preprocessing/{datasetId}/synthetic',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
  };
}

function asResponse(result: unknown): { statusCode: number; body: string } {
  return result as { statusCode: number; body: string };
}
