import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';

import { tokenFakeDatasetService } from '../../services/DatasetService/FakeDatasetService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { GetDatasetPreviewUseCaseImpl } from './GetDatasetPreviewUseCase';

const makeCsv = (n: number) =>
  `document\n${Array.from({ length: n }, (_, i) => `"Doc ${i + 1}"`).join('\n')}`;

describe('GetDatasetPreviewUseCase', () => {
  it('returns at most 10 samples from a larger dataset', async () => {
    const { useCase, datasetService } = setup();
    await datasetService.upload('ds-1', makeCsv(25), 'csv');

    const result = await useCase.getDatasetPreview('ds-1');

    expect(result.dataset_id).toBe('ds-1');
    expect(result.samples).toHaveLength(10);
    expect(result.samples[0].document).toBe('Doc 1');
  });

  it('returns all samples when dataset has fewer than 10', async () => {
    const { useCase, datasetService } = setup();
    await datasetService.upload('ds-2', makeCsv(5), 'csv');

    const result = await useCase.getDatasetPreview('ds-2');

    expect(result.samples).toHaveLength(5);
  });

  it('propagates dataset not found errors', async () => {
    const { useCase } = setup();
    await expect(useCase.getDatasetPreview('missing')).rejects.toThrow(
      'Dataset not found',
    );
  });
});

const setup = () => {
  reset();
  registerTestInfrastructure();
  return {
    useCase: new GetDatasetPreviewUseCaseImpl(),
    datasetService: inject(tokenFakeDatasetService),
  };
};
