import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';

import { ConvertedDatasetRow } from '../../models/SyntheticOutput';
import {
  FakeDatasetService,
  tokenFakeDatasetService,
} from '../../services/DatasetService/FakeDatasetService';
import { tokenFakeSyntheticOutputModelClient } from '../../services/SyntheticOutputModelClient/FakeSyntheticOutputModelClient';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { GenerateSyntheticOutputsUseCaseImpl } from './GenerateSyntheticOutputsUseCase';

describe('GenerateSyntheticOutputsUseCase', () => {
  it('generates summaries for converted dataset rows', async () => {
    const { fakeDatasetService, fakeModelClient, useCase } = setup();
    fakeDatasetService.seedConvertedDatasetRows(
      'datasets/demo-dataset/demo-dataset-converted.jsonl',
      summarizationConvertedRows(),
    );
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
    expect(expectWrittenSyntheticRows(fakeDatasetService)).toEqual([
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
    expect(fakeModelClient.requests[0].prompt).toContain(
      'First document chunk',
    );
    expect(fakeModelClient.requests[0].modelId).toBe('test-model');
  });

  it('generates normalized class labels for classification converted rows', async () => {
    const { fakeDatasetService, fakeModelClient, useCase } = setup();
    fakeDatasetService.seedConvertedDatasetRows(
      'datasets/demo-dataset/demo-dataset-converted.jsonl',
      classificationConvertedRows(),
    );
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
    expect(expectWrittenSyntheticRows(fakeDatasetService)[0]).toEqual({
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
    expect(fakeModelClient.requests[0].prompt).toContain(
      'Refunds are available after billing errors.',
    );
  });

  it('records failed rows when model generation fails', async () => {
    const { fakeDatasetService, fakeModelClient, useCase } = setup();
    fakeDatasetService.seedConvertedDatasetRows(
      'datasets/demo-dataset/demo-dataset-converted.jsonl',
      summarizationConvertedRows(),
    );
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
    expect(expectWrittenSyntheticRows(fakeDatasetService)[1]).toMatchObject({
      chunk_id: 'demo-dataset-1',
      summary: '',
      status: 'failed',
      error_message: 'model failed',
    });
  });

  it('records failed rows when normalized model output is empty', async () => {
    const { fakeDatasetService, fakeModelClient, useCase } = setup();
    fakeDatasetService.seedConvertedDatasetRows(
      'datasets/demo-dataset/demo-dataset-converted.jsonl',
      classificationConvertedRows(),
    );
    fakeModelClient.queueOutput('   ');

    const result = await useCase.generateSyntheticOutputs({
      datasetId: 'demo-dataset',
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      taskType: 'classification',
    });

    expect(result.generatedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(expectWrittenSyntheticRows(fakeDatasetService)[0]).toMatchObject({
      class: '',
      status: 'failed',
      error_message: 'Synthetic output cannot be empty',
    });
  });

  it('retries only failed rows and preserves completed rows', async () => {
    const { fakeDatasetService, fakeModelClient, useCase } = setup();
    fakeDatasetService.seedConvertedDatasetRows(
      'datasets/demo-dataset/demo-dataset-converted.jsonl',
      summarizationConvertedRows(),
    );
    fakeModelClient.queueOutput('Summary one');
    fakeModelClient.queueError(new Error('transient failure'));

    const initial = await useCase.generateSyntheticOutputs({
      datasetId: 'demo-dataset',
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      taskType: 'summarization',
      modelId: 'test-model',
    });

    expect(initial.failedCount).toBe(1);

    fakeModelClient.queueOutput('Summary two recovered');

    const retried = await useCase.retryFailedRows({
      datasetId: 'demo-dataset',
      syntheticDatasetArtifactKey: initial.syntheticDatasetArtifactKey,
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      taskType: 'summarization',
      modelId: 'test-model',
    });

    expect(retried.generatedCount).toBe(2);
    expect(retried.failedCount).toBe(0);
    expect(expectWrittenSyntheticRows(fakeDatasetService)).toEqual([
      expect.objectContaining({
        chunk_id: 'demo-dataset-0',
        summary: 'Summary one',
        status: 'completed',
      }),
      expect.objectContaining({
        chunk_id: 'demo-dataset-1',
        summary: 'Summary two recovered',
        status: 'completed',
      }),
    ]);
  });

  it('keeps rows as failed if retry also fails', async () => {
    const { fakeDatasetService, fakeModelClient, useCase } = setup();
    fakeDatasetService.seedConvertedDatasetRows(
      'datasets/demo-dataset/demo-dataset-converted.jsonl',
      summarizationConvertedRows(),
    );
    fakeModelClient.queueOutput('Summary one');
    fakeModelClient.queueError(new Error('first failure'));

    const initial = await useCase.generateSyntheticOutputs({
      datasetId: 'demo-dataset',
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      taskType: 'summarization',
    });

    fakeModelClient.queueError(new Error('second failure'));

    const retried = await useCase.retryFailedRows({
      datasetId: 'demo-dataset',
      syntheticDatasetArtifactKey: initial.syntheticDatasetArtifactKey,
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      taskType: 'summarization',
    });

    expect(retried.generatedCount).toBe(1);
    expect(retried.failedCount).toBe(1);
    expect(expectWrittenSyntheticRows(fakeDatasetService)[1]).toMatchObject({
      chunk_id: 'demo-dataset-1',
      status: 'failed',
      error_message: 'second failure',
    });
  });
});

function setup() {
  reset();
  registerTestInfrastructure();

  return {
    fakeDatasetService: inject(tokenFakeDatasetService),
    fakeModelClient: inject(tokenFakeSyntheticOutputModelClient),
    useCase: new GenerateSyntheticOutputsUseCaseImpl(),
  };
}

function expectWrittenSyntheticRows(
  fakeDatasetService: FakeDatasetService,
): unknown[] {
  const artifact = fakeDatasetService.artifacts.find(
    (a) => a.key === 'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
  );
  expect(artifact).toMatchObject({
    key: 'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
    contentType: 'application/jsonl',
  });

  return String(artifact?.body)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
}

function summarizationConvertedRows(): ConvertedDatasetRow[] {
  return [
    {
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-0',
      document: 'First document chunk',
    },
    {
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-1',
      document: 'Second document chunk',
    },
  ];
}

function classificationConvertedRows(): ConvertedDatasetRow[] {
  return [
    {
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-0',
      document: 'Refunds are available after billing errors.',
    },
  ];
}
