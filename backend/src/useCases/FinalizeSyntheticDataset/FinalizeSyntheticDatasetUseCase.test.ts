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
import { FinalizeSyntheticDatasetUseCaseImpl } from './FinalizeSyntheticDatasetUseCase';

describe('FinalizeSyntheticDatasetUseCase', () => {
  it('reconstructs the synthetic dataset from the manifest and generates the structured dataset', async () => {
    const { fakeDatasetService, useCase } = setup();
    fakeDatasetService.seedRawObject(
      'preprocessing-results/demo-dataset/manifest.json',
      JSON.stringify({
        ResultFiles: {
          SUCCEEDED: [
            {
              Key: 'preprocessing-results/demo-dataset/SUCCEEDED_0.json',
              Size: 100,
            },
          ],
          FAILED: [],
          PENDING: [],
        },
      }),
    );
    fakeDatasetService.seedRawObject(
      'preprocessing-results/demo-dataset/SUCCEEDED_0.json',
      [
        completedRow('demo-dataset-0', 'Summary one'),
        completedRow('demo-dataset-1', 'Summary two'),
      ]
        .map((row) => JSON.stringify(row))
        .join('\n'),
    );

    const result = await useCase.execute({
      datasetId: 'demo-dataset',
      manifestKey: 'preprocessing-results/demo-dataset/manifest.json',
    });

    expect(result).toMatchObject({
      datasetId: 'demo-dataset',
      syntheticDatasetArtifactKey: syntheticDatasetS3Key('demo-dataset'),
      structuredDatasetArtifactKey: structuredDatasetS3Key('demo-dataset'),
      failedCount: 0,
      sampleCount: 2,
    });
    expect(writtenSyntheticRows(fakeDatasetService)).toEqual([
      completedRow('demo-dataset-0', 'Summary one'),
      completedRow('demo-dataset-1', 'Summary two'),
    ]);
  });

  it('includes business-failed rows (status: failed) alongside completed ones, and counts them', async () => {
    const { fakeDatasetService, useCase } = setup();
    fakeDatasetService.seedRawObject(
      'preprocessing-results/demo-dataset/manifest.json',
      JSON.stringify({
        ResultFiles: {
          SUCCEEDED: [
            {
              Key: 'preprocessing-results/demo-dataset/SUCCEEDED_0.json',
              Size: 100,
            },
          ],
          FAILED: [],
          PENDING: [],
        },
      }),
    );
    fakeDatasetService.seedRawObject(
      'preprocessing-results/demo-dataset/SUCCEEDED_0.json',
      [
        completedRow('demo-dataset-0', 'Summary one'),
        failedRow('demo-dataset-1'),
      ]
        .map((row) => JSON.stringify(row))
        .join('\n'),
    );

    const result = await useCase.execute({
      datasetId: 'demo-dataset',
      manifestKey: 'preprocessing-results/demo-dataset/manifest.json',
    });

    // A per-document business failure (empty output, validation, etc.) is a
    // normal SUCCEEDED iteration from Step Functions' point of view - it's
    // recorded in the row data itself. This is what makes partial success
    // possible: one bad row doesn't block the rest.
    expect(result).toMatchObject({
      failedCount: 1,
      sampleCount: 1,
    });
    expect(writtenSyntheticRows(fakeDatasetService)).toEqual([
      completedRow('demo-dataset-0', 'Summary one'),
      failedRow('demo-dataset-1'),
    ]);
  });

  it('counts genuine infra-level failures (manifest FAILED/PENDING) without blocking the run', async () => {
    const { fakeDatasetService, useCase } = setup();
    fakeDatasetService.seedRawObject(
      'preprocessing-results/demo-dataset/manifest.json',
      JSON.stringify({
        ResultFiles: {
          SUCCEEDED: [
            {
              Key: 'preprocessing-results/demo-dataset/SUCCEEDED_0.json',
              Size: 50,
            },
          ],
          FAILED: [
            {
              Key: 'preprocessing-results/demo-dataset/FAILED_0.json',
              Size: 10,
            },
          ],
          PENDING: [
            {
              Key: 'preprocessing-results/demo-dataset/PENDING_0.json',
              Size: 10,
            },
          ],
        },
      }),
    );
    fakeDatasetService.seedRawObject(
      'preprocessing-results/demo-dataset/SUCCEEDED_0.json',
      JSON.stringify(completedRow('demo-dataset-0', 'Summary one')),
    );

    const result = await useCase.execute({
      datasetId: 'demo-dataset',
      manifestKey: 'preprocessing-results/demo-dataset/manifest.json',
    });

    // 1 iteration crashed (FAILED) + 1 was never started (PENDING) = 2,
    // added on top of the 0 business failures among SUCCEEDED rows.
    expect(result).toMatchObject({ sampleCount: 1, failedCount: 2 });
  });

  it('still throws when every row failed - nothing usable to build a dataset from', async () => {
    const { fakeDatasetService, useCase } = setup();
    fakeDatasetService.seedRawObject(
      'preprocessing-results/demo-dataset/manifest.json',
      JSON.stringify({
        ResultFiles: {
          SUCCEEDED: [
            {
              Key: 'preprocessing-results/demo-dataset/SUCCEEDED_0.json',
              Size: 10,
            },
          ],
          FAILED: [],
          PENDING: [],
        },
      }),
    );
    fakeDatasetService.seedRawObject(
      'preprocessing-results/demo-dataset/SUCCEEDED_0.json',
      JSON.stringify(failedRow('demo-dataset-0')),
    );

    await expect(
      useCase.execute({
        datasetId: 'demo-dataset',
        manifestKey: 'preprocessing-results/demo-dataset/manifest.json',
      }),
    ).rejects.toMatchObject({ code: 'SYNTHETIC_GENERATION_ALL_FAILED' });
  });
});

function setup() {
  reset();
  registerTestInfrastructure();

  return {
    fakeDatasetService: inject(tokenFakeDatasetService),
    useCase: new FinalizeSyntheticDatasetUseCaseImpl(),
  };
}

function writtenSyntheticRows(
  fakeDatasetService: FakeDatasetService,
): unknown[] {
  const artifact = fakeDatasetService.artifacts.find(
    (a) => a.key === 'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
  );
  return String(artifact?.body)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
}

function completedRow(chunkId: string, summary: string) {
  return {
    chunk_id: chunkId,
    document_id: 'demo-dataset',
    text: 'Some document chunk',
    summary,
    status: 'completed' as const,
    model_id: 'test-model',
  };
}

function failedRow(chunkId: string) {
  return {
    chunk_id: chunkId,
    document_id: 'demo-dataset',
    text: 'Some document chunk',
    status: 'failed' as const,
    error_message: 'model failed',
  };
}
