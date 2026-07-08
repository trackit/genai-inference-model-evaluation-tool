import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';

import { tokenClientS3 } from '../../services/DatasetService/DatasetServiceS3';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { GenerateStructuredDatasetUseCaseImpl } from './GenerateStructuredDatasetUseCase';

describe('GenerateStructuredDatasetUseCase', () => {
  it('creates an evaluator-ready summarization dataset', async () => {
    const { s3ClientMock, useCase } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => summarizationSyntheticArtifact(),
      } as never,
    });
    s3ClientMock.on(PutObjectCommand).resolves({});

    const result = await useCase.generateStructuredDataset({
      datasetId: 'demo-dataset',
      syntheticDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
    });

    expect(result).toEqual({
      datasetId: 'demo-dataset',
      structuredDatasetArtifactKey: 'datasets/demo-dataset.jsonl',
      sampleCount: 2,
    });
    expect(expectWrittenStructuredRows(s3ClientMock)).toEqual([
      {
        document: 'First document chunk',
        summary: 'Summary one',
      },
      {
        document: 'Second document chunk',
        summary: 'Summary two',
      },
    ]);
  });

  it('creates an evaluator-ready classification dataset', async () => {
    const { s3ClientMock, useCase } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => classificationSyntheticArtifact(),
      } as never,
    });
    s3ClientMock.on(PutObjectCommand).resolves({});

    await useCase.generateStructuredDataset({
      datasetId: 'demo-dataset',
      syntheticDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
    });

    expect(expectWrittenStructuredRows(s3ClientMock)[0]).toEqual({
      document: 'Refunds are available after billing errors.',
      class: 'support_policy',
    });
  });

  it('rejects failed synthetic rows before writing the final dataset', async () => {
    const { s3ClientMock, useCase } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => failedSyntheticArtifact(),
      } as never,
    });
    s3ClientMock.on(PutObjectCommand).resolves({});

    await expect(
      useCase.generateStructuredDataset({
        datasetId: 'demo-dataset',
        syntheticDatasetArtifactKey:
          'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      }),
    ).rejects.toMatchObject({
      code: 'SYNTHETIC_OUTPUT_INCOMPLETE',
    });
    expect(s3ClientMock.commandCalls(PutObjectCommand)).toHaveLength(0);
  });

  it('rejects empty generated summaries', async () => {
    const { s3ClientMock, useCase } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () =>
          JSON.stringify({
            document_id: 'demo-dataset',
            chunk_id: 'demo-dataset-0',
            text: 'Chunk text',
            summary: '',
            status: 'completed',
          }),
      } as never,
    });

    await expect(
      useCase.generateStructuredDataset({
        datasetId: 'demo-dataset',
        syntheticDatasetArtifactKey:
          'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      }),
    ).rejects.toMatchObject({
      code: 'SYNTHETIC_OUTPUT_INCOMPLETE',
    });
  });
});

function setup() {
  reset();
  registerTestInfrastructure();
  process.env.DATASET_BUCKET = 'test-bucket';

  return {
    s3ClientMock: mockClient(inject(tokenClientS3)),
    useCase: new GenerateStructuredDatasetUseCaseImpl(),
  };
}

function expectWrittenStructuredRows(
  s3ClientMock: ReturnType<typeof mockClient>,
): unknown[] {
  const putObjectInput =
    s3ClientMock.commandCalls(PutObjectCommand)[0].args[0].input;

  expect(putObjectInput).toMatchObject({
    Bucket: 'test-bucket',
    Key: 'datasets/demo-dataset.jsonl',
    ContentType: 'application/jsonl',
    ServerSideEncryption: 'AES256',
  });

  return String(putObjectInput.Body)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
}

function summarizationSyntheticArtifact(): string {
  return [
    JSON.stringify({
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-0',
      text: 'First document chunk',
      summary: 'Summary one',
      status: 'completed',
    }),
    JSON.stringify({
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-1',
      text: 'Second document chunk',
      summary: 'Summary two',
      status: 'completed',
    }),
  ].join('\n');
}

function classificationSyntheticArtifact(): string {
  return JSON.stringify({
    document_id: 'demo-dataset',
    chunk_id: 'demo-dataset-0',
    text: 'Refunds are available after billing errors.',
    class: 'support_policy',
    status: 'completed',
  });
}

function failedSyntheticArtifact(): string {
  return JSON.stringify({
    document_id: 'demo-dataset',
    chunk_id: 'demo-dataset-0',
    text: 'Chunk text',
    summary: '',
    status: 'failed',
    error_message: 'model failed',
  });
}
