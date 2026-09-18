import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';

import {
  structuredDatasetS3Key,
  syntheticDatasetS3Key,
} from 'backend/src/services/DatasetService/DatasetServiceS3';
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
      syntheticDatasetArtifactKey: syntheticDatasetS3Key('demo-dataset'),
    });

    expect(result).toEqual({
      datasetId: 'demo-dataset',
      structuredDatasetArtifactKey: structuredDatasetS3Key('demo-dataset'),
      sampleCount: 2,
      failedCount: 0,
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
      syntheticDatasetArtifactKey: syntheticDatasetS3Key('demo-dataset'),
    });

    expect(expectWrittenStructuredRows(fakeDatasetService)[0]).toEqual({
      document: 'Refunds are available after billing errors.',
      class: 'support_policy',
    });
  });

  it('excludes failed rows from the structured dataset but still succeeds with the rest', async () => {
    const { fakeDatasetService, useCase } = setup();
    seedSyntheticArtifact(fakeDatasetService, mixedSyntheticArtifact());

    const result = await useCase.generateStructuredDataset({
      datasetId: 'demo-dataset',
      syntheticDatasetArtifactKey: syntheticDatasetS3Key('demo-dataset'),
    });

    expect(result).toMatchObject({ sampleCount: 1, failedCount: 1 });
    expect(expectWrittenStructuredRows(fakeDatasetService)).toEqual([
      { document: 'First document chunk', summary: 'Summary one' },
    ]);
  });

  it('throws only when every row failed - nothing usable to build a dataset from', async () => {
    const { fakeDatasetService, useCase } = setup();
    seedSyntheticArtifact(fakeDatasetService, failedSyntheticArtifact());

    await expect(
      useCase.generateStructuredDataset({
        datasetId: 'demo-dataset',
        syntheticDatasetArtifactKey: syntheticDatasetS3Key('demo-dataset'),
      }),
    ).rejects.toMatchObject({
      code: 'SYNTHETIC_GENERATION_ALL_FAILED',
    });
    expect(
      fakeDatasetService.artifacts.some(
        (a) => a.key === structuredDatasetS3Key('demo-dataset'),
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
        syntheticDatasetArtifactKey: syntheticDatasetS3Key('demo-dataset'),
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
    key: syntheticDatasetS3Key('demo-dataset'),
    body,
    contentType: 'application/jsonl',
  });
}

function expectWrittenStructuredRows(
  fakeDatasetService: FakeDatasetService,
): unknown[] {
  const artifact = fakeDatasetService.artifacts.find(
    (a) => a.key === structuredDatasetS3Key('demo-dataset'),
  );
  expect(artifact).toMatchObject({
    key: structuredDatasetS3Key('demo-dataset'),
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

function mixedSyntheticArtifact(): string {
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
      status: 'failed',
      error_message: 'model failed',
    }),
  ].join('\n');
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
