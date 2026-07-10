import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';

import {
  FakeDatasetService,
  tokenFakeDatasetService,
} from '../../services/DatasetService/FakeDatasetService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { GenerateStructuredDatasetUseCaseImpl } from './GenerateStructuredDatasetUseCase';

describe('GenerateStructuredDatasetUseCase', () => {
  it('creates an evaluator-ready summarization dataset', async () => {
    const { fakeDatasetService, useCase } = setup();
    seedSyntheticArtifact(fakeDatasetService, summarizationSyntheticArtifact());

    const result = await useCase.generateStructuredDataset({
      datasetId: 'demo-dataset',
      syntheticDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
    });

    expect(result).toEqual({
      datasetId: 'demo-dataset',
      structuredDatasetArtifactKey: 'datasets/demo-dataset/demo-dataset.jsonl',
      sampleCount: 2,
    });
    expect(expectWrittenStructuredRows(fakeDatasetService)).toEqual([
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
    const { fakeDatasetService, useCase } = setup();
    seedSyntheticArtifact(
      fakeDatasetService,
      classificationSyntheticArtifact(),
    );

    await useCase.generateStructuredDataset({
      datasetId: 'demo-dataset',
      syntheticDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
    });

    expect(expectWrittenStructuredRows(fakeDatasetService)[0]).toEqual({
      document: 'Refunds are available after billing errors.',
      class: 'support_policy',
    });
  });

  it('rejects failed synthetic rows before writing the final dataset', async () => {
    const { fakeDatasetService, useCase } = setup();
    seedSyntheticArtifact(fakeDatasetService, failedSyntheticArtifact());

    await expect(
      useCase.generateStructuredDataset({
        datasetId: 'demo-dataset',
        syntheticDatasetArtifactKey:
          'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      }),
    ).rejects.toMatchObject({
      code: 'SYNTHETIC_OUTPUT_INCOMPLETE',
    });
    expect(
      fakeDatasetService.artifacts.some(
        (a) => a.key === 'datasets/demo-dataset.jsonl',
      ),
    ).toBe(false);
  });

  it('rejects empty generated summaries', async () => {
    const { fakeDatasetService, useCase } = setup();
    seedSyntheticArtifact(
      fakeDatasetService,
      JSON.stringify({
        document_id: 'demo-dataset',
        chunk_id: 'demo-dataset-0',
        text: 'Chunk text',
        summary: '',
        status: 'completed',
      }),
    );

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

  return {
    fakeDatasetService: inject(tokenFakeDatasetService),
    useCase: new GenerateStructuredDatasetUseCaseImpl(),
  };
}

function seedSyntheticArtifact(
  fakeDatasetService: FakeDatasetService,
  body: string,
): void {
  fakeDatasetService.artifacts.push({
    key: 'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
    body,
    contentType: 'application/jsonl',
  });
}

function expectWrittenStructuredRows(
  fakeDatasetService: FakeDatasetService,
): unknown[] {
  const artifact = fakeDatasetService.artifacts.find(
    (a) => a.key === 'datasets/demo-dataset.jsonl',
  );
  expect(artifact).toMatchObject({
    key: 'datasets/demo-dataset.jsonl',
    contentType: 'application/jsonl',
  });

  return String(artifact?.body)
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
