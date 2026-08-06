import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';

import { BasicErrorType } from '../../errors';
import {
  FakeDatasetService,
  tokenFakeDatasetService,
} from '../../services/DatasetService/FakeDatasetService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { EditGroundTruthUseCaseImpl } from './EditGroundTruthUseCase';

const SAMPLE_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_SAMPLE_ID = '660e8400-e29b-41d4-a716-446655440001';

async function seedDataset(
  datasetService: FakeDatasetService,
  rows: Array<Record<string, string>>,
): Promise<void> {
  const content = rows.map((row) => JSON.stringify(row)).join('\n');
  await datasetService.upload('ds-1', content, 'jsonl');
}

function readStoredSamples(datasetService: FakeDatasetService): unknown[] {
  const stored = datasetService.uploads.find((u) => u.datasetId === 'ds-1');
  expect(stored).toBeDefined();

  return String(stored?.content)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
}

describe('EditGroundTruthUseCase', () => {
  it('updates multiple samples in one write', async () => {
    const { useCase, datasetService } = setup();
    await seedDataset(datasetService, [
      {
        sample_id: SAMPLE_ID,
        document: 'Doc 1',
        summary: 'Old summary',
      },
      {
        sample_id: OTHER_SAMPLE_ID,
        document: 'Doc 2',
        summary: 'Other summary',
      },
    ]);

    await useCase.editGroundTruth({
      datasetId: 'ds-1',
      edits: {
        [SAMPLE_ID]: 'Updated summary',
        [OTHER_SAMPLE_ID]: 'Updated other',
      },
    });

    expect(readStoredSamples(datasetService)).toEqual([
      {
        sample_id: SAMPLE_ID,
        document: 'Doc 1',
        summary: 'Updated summary',
      },
      {
        sample_id: OTHER_SAMPLE_ID,
        document: 'Doc 2',
        summary: 'Updated other',
      },
    ]);
  });

  it('updates class labels for classification datasets', async () => {
    const { useCase, datasetService } = setup();
    await seedDataset(datasetService, [
      {
        sample_id: SAMPLE_ID,
        document: 'Doc 1',
        class: 'positive',
      },
    ]);

    await useCase.editGroundTruth({
      datasetId: 'ds-1',
      edits: { [SAMPLE_ID]: 'negative' },
    });

    expect(readStoredSamples(datasetService)[0]).toEqual({
      sample_id: SAMPLE_ID,
      document: 'Doc 1',
      class: 'negative',
    });
  });

  it('throws when dataset is not found', async () => {
    const { useCase } = setup();

    await expect(
      useCase.editGroundTruth({
        datasetId: 'missing',
        edits: { [SAMPLE_ID]: 'Updated summary' },
      }),
    ).rejects.toMatchObject({
      code: 'DATASET_NOT_FOUND',
    });
  });

  it('throws when sample has no summary or class label field', async () => {
    const { useCase, datasetService } = setup();

    await seedDataset(datasetService, [
      {
        sample_id: SAMPLE_ID,
        document: 'Doc without ground truth',
      },
    ]);

    await expect(
      useCase.editGroundTruth({
        datasetId: 'ds-1',
        edits: {
          [SAMPLE_ID]: 'New correction',
        },
      }),
    ).rejects.toMatchObject({
      type: BasicErrorType.UNPROCESSABLE_ENTITY,
      code: 'GROUND_TRUTH_FIELD_MISSING',
    });
  });

  it('throws when sample id is not found', async () => {
    const { useCase, datasetService } = setup();
    await seedDataset(datasetService, [
      {
        sample_id: SAMPLE_ID,
        document: 'Doc 1',
        summary: 'Summary',
      },
    ]);

    await expect(
      useCase.editGroundTruth({
        datasetId: 'ds-1',
        edits: {
          '770e8400-e29b-41d4-a716-446655440002': 'Updated summary',
        },
      }),
    ).rejects.toMatchObject({
      code: 'SAMPLE_NOT_FOUND',
    });
  });

  it('rejects empty corrected ground truth', async () => {
    const { useCase, datasetService } = setup();
    await seedDataset(datasetService, [
      {
        sample_id: SAMPLE_ID,
        document: 'Doc 1',
        summary: 'Summary',
      },
    ]);

    await expect(
      useCase.editGroundTruth({
        datasetId: 'ds-1',
        edits: { [SAMPLE_ID]: '   ' },
      }),
    ).rejects.toMatchObject({
      type: BasicErrorType.BAD_REQUEST,
      code: 'CORRECTED_GROUND_TRUTH_REQUIRED',
    });
  });

  it('rejects an empty edits map', async () => {
    const { useCase } = setup();

    await expect(
      useCase.editGroundTruth({
        datasetId: 'ds-1',
        edits: {},
      }),
    ).rejects.toMatchObject({
      type: BasicErrorType.BAD_REQUEST,
      code: 'EDITS_REQUIRED',
    });
  });
});

const setup = () => {
  reset();
  registerTestInfrastructure();

  return {
    useCase: new EditGroundTruthUseCaseImpl(),
    datasetService: inject(tokenFakeDatasetService),
  };
};
