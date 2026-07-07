import { GetObjectCommand } from '@aws-sdk/client-s3';
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
    expect(result.rows).toEqual([
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
      generatedCount: 1,
      failedCount: 0,
    });
    expect(result.rows[0]).toEqual({
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
    expect(result.rows[1]).toMatchObject({
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
    expect(result.rows[0]).toMatchObject({
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

  return {
    fakeModelClient: inject(tokenFakeSyntheticOutputModelClient),
    s3ClientMock: mockClient(inject(tokenClientS3)),
    useCase: new GenerateSyntheticOutputsUseCaseImpl(),
  };
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
