import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';

import { tokenClientS3 } from '../../services/DatasetService/DatasetServiceS3';
import { tokenFakeSyntheticOutputModelClient } from '../../services/SyntheticOutputModelClient/FakeSyntheticOutputModelClient';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { GenerateSyntheticOutputsUseCaseImpl } from './GenerateSyntheticOutputsUseCase';

describe('GenerateSyntheticOutputsUseCase', () => {
  it('generates summaries for converted dataset rows', async () => {
    const { fakeModelClient, s3ClientMock, useCase } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => summarizationConvertedArtifact(),
      } as never,
    });
    fakeModelClient.queueOutput('Summary one');
    fakeModelClient.queueOutput('Summary two');

    const result = await useCase.generateSyntheticOutputs({
      datasetId: 'demo-dataset',
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      taskType: 'summarization',
      modelId: 'test-model',
    });

    expect(result.generatedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.syntheticDatasetArtifactKey).toBe(
      'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
    );
    expect(expectWrittenSyntheticRows(s3ClientMock)).toEqual([
      {
        document_id: 'demo-dataset',
        chunk_id: 'demo-dataset-0',
        text: 'First document chunk',
        summary: 'Summary one',
        status: 'completed',
        model_id: 'test-model',
      },
      {
        document_id: 'demo-dataset',
        chunk_id: 'demo-dataset-1',
        text: 'Second document chunk',
        summary: 'Summary two',
        status: 'completed',
        model_id: 'test-model',
      },
    ]);
    expect(fakeModelClient.requests).toHaveLength(2);
    expect(fakeModelClient.requests[0].prompt).toContain(
      'Generate a concise reference summary',
    );
    expect(fakeModelClient.requests[0].modelId).toBe('test-model');
  });

  it('generates normalized class labels for classification converted rows', async () => {
    const { fakeModelClient, s3ClientMock, useCase } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => classificationConvertedArtifact(),
      } as never,
    });
    fakeModelClient.queueOutput('Classification label: Support Policy.');

    const result = await useCase.generateSyntheticOutputs({
      datasetId: 'demo-dataset',
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      taskType: 'classification',
    });

    expect(result).toMatchObject({
      syntheticDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      generatedCount: 1,
      failedCount: 0,
    });
    expect(expectWrittenSyntheticRows(s3ClientMock)[0]).toEqual({
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-0',
      text: 'Refunds are available after billing errors.',
      class: 'support_policy',
      status: 'completed',
      model_id: 'fake-synthetic-output-model',
    });
    expect(fakeModelClient.requests[0].prompt).toContain(
      'Generate one short canonical class label',
    );
  });

  it('records failed rows when model generation fails', async () => {
    const { fakeModelClient, s3ClientMock, useCase } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => summarizationConvertedArtifact(),
      } as never,
    });
    fakeModelClient.queueOutput('Summary one');
    fakeModelClient.queueError(new Error('model failed'));

    const result = await useCase.generateSyntheticOutputs({
      datasetId: 'demo-dataset',
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      taskType: 'summarization',
    });

    expect(result.generatedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(expectWrittenSyntheticRows(s3ClientMock)[1]).toMatchObject({
      chunk_id: 'demo-dataset-1',
      summary: '',
      status: 'failed',
      error_message: 'model failed',
    });
  });

  it('records failed rows when normalized model output is empty', async () => {
    const { fakeModelClient, s3ClientMock, useCase } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => classificationConvertedArtifact(),
      } as never,
    });
    fakeModelClient.queueOutput('   ');

    const result = await useCase.generateSyntheticOutputs({
      datasetId: 'demo-dataset',
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      taskType: 'classification',
    });

    expect(result.generatedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(expectWrittenSyntheticRows(s3ClientMock)[0]).toMatchObject({
      class: '',
      status: 'failed',
      error_message: 'Synthetic output cannot be empty',
    });
  });

  it('rejects converted rows that do not match the requested task type', async () => {
    const { s3ClientMock, useCase } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => classificationConvertedArtifact(),
      } as never,
    });

    await expect(
      useCase.generateSyntheticOutputs({
        datasetId: 'demo-dataset',
        convertedDatasetArtifactKey:
          'datasets/demo-dataset/demo-dataset-converted.jsonl',
        taskType: 'summarization',
      }),
    ).rejects.toMatchObject({
      code: 'CONVERTED_DATASET_TASK_FIELD_MISMATCH',
    });
  });
});

function setup() {
  reset();
  registerTestInfrastructure();
  process.env.DATASET_BUCKET = 'test-bucket';
  const s3ClientMock = mockClient(inject(tokenClientS3));
  s3ClientMock.on(PutObjectCommand).resolves({});

  return {
    fakeModelClient: inject(tokenFakeSyntheticOutputModelClient),
    s3ClientMock,
    useCase: new GenerateSyntheticOutputsUseCaseImpl(),
  };
}

function expectWrittenSyntheticRows(
  s3ClientMock: ReturnType<typeof mockClient>,
): unknown[] {
  const putObjectInput =
    s3ClientMock.commandCalls(PutObjectCommand)[0].args[0].input;

  expect(putObjectInput).toMatchObject({
    Bucket: 'test-bucket',
    Key: 'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
    ContentType: 'application/jsonl',
    ServerSideEncryption: 'AES256',
  });

  return String(putObjectInput.Body)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
}

function summarizationConvertedArtifact(): string {
  return [
    JSON.stringify({
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-0',
      text: 'First document chunk',
      summary: '',
    }),
    JSON.stringify({
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-1',
      text: 'Second document chunk',
      summary: '',
    }),
  ].join('\n');
}

function classificationConvertedArtifact(): string {
  return JSON.stringify({
    document_id: 'demo-dataset',
    chunk_id: 'demo-dataset-0',
    text: 'Refunds are available after billing errors.',
    class: '',
  });
}
