import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';

import { datasetS3Key } from 'backend/src/services/DatasetService/DatasetServiceS3';
import { tokenFakeDatasetService } from '../../services/DatasetService/FakeDatasetService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { GetDatasetPreviewUseCaseImpl } from './GetDatasetPreviewUseCase';

const makeCsv = (n: number) =>
  `document\n${Array.from({ length: n }, (_, i) => `"Doc ${i + 1}"`).join('\n')}`;

describe('GetDatasetPreviewUseCase', () => {
  it('returns at most 10 samples from a larger dataset', async () => {
    const { useCase, datasetService } = setup();
    await datasetService.upload('ds-1', makeCsv(25), 'csv');
    await datasetService.writeUploadManifest('ds-1', {
      max_total_bytes: 1000000,
      files: [
        {
          document_id: 'ds-1',
          filename: 'dataset.csv',
          file_type: 'csv',
          s3_key: datasetS3Key('ds-1', 'csv'),
          size_bytes: 100,
        },
      ],
    });

    const result = await useCase.getDatasetPreview('ds-1');

    expect(result.dataset_id).toBe('ds-1');
    expect(result.samples).toHaveLength(10);
    expect(result.samples[0].document).toBe('Doc 1');
  });

  it('returns all samples when dataset has fewer than 10', async () => {
    const { useCase, datasetService } = setup();
    await datasetService.upload('ds-2', makeCsv(5), 'csv');
    await datasetService.writeUploadManifest('ds-2', {
      max_total_bytes: 1000000,
      files: [
        {
          document_id: 'ds-2',
          filename: 'dataset.csv',
          file_type: 'csv',
          s3_key: datasetS3Key('ds-2', 'csv'),
          size_bytes: 100,
        },
      ],
    });

    const result = await useCase.getDatasetPreview('ds-2');

    expect(result.samples).toHaveLength(5);
  });

  it('propagates dataset not found errors', async () => {
    const { useCase } = setup();
    await expect(useCase.getDatasetPreview('missing')).rejects.toThrow(
      'Dataset not found',
    );
  });

  it('returns samples for a preprocessed document dataset once the structured dataset has been written', async () => {
    const { useCase, datasetService } = setup();

    await datasetService.writeUploadManifest('ds-3', {
      max_total_bytes: 1000000,
      files: [
        {
          document_id: 'doc-1',
          filename: 'report.pdf',
          file_type: 'pdf',
          s3_key: 'datasets/ds-3/doc-1.pdf',
          size_bytes: 100,
        },
      ],
    });

    await datasetService.writeStructuredDataset('ds-3', [
      { document: 'Doc A', summary: 'Summary A' },
      { document: 'Doc B', summary: 'Summary B' },
    ]);

    const result = await useCase.getDatasetPreview('ds-3');

    expect(result.dataset_id).toBe('ds-3');
    expect(result.samples).toHaveLength(2);
    expect(result.samples[0]).toEqual({
      document: 'Doc A',
      summary: 'Summary A',
    });
  });

  it('reports dataset not found when a document dataset has not finished preprocessing yet', async () => {
    const { useCase, datasetService } = setup();
    await datasetService.writeUploadManifest('ds-4', {
      max_total_bytes: 1000000,
      files: [
        {
          document_id: 'doc-1',
          filename: 'report.pdf',
          file_type: 'pdf',
          s3_key: 'datasets/ds-4/doc-1.pdf',
          size_bytes: 100,
        },
      ],
    });

    await expect(useCase.getDatasetPreview('ds-4')).rejects.toThrow(
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
