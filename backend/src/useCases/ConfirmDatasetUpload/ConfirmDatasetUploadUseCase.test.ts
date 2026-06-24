import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';

import { tokenFakeDatasetService } from '../../services/DatasetService/FakeDatasetService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { ConfirmDatasetUploadUseCaseImpl } from './ConfirmDatasetUploadUseCase';

const defaultCsv = `document\n${Array.from({ length: 10 }, (_, i) => `"Question ${i + 1}"`).join('\n')}`;

describe('ConfirmDatasetUploadUseCase', () => {
  it('returns metadata for a valid csv dataset', async () => {
    const { useCase, datasetService } = setup();
    await datasetService.upload('dataset-id', defaultCsv, 'csv');

    await expect(datasetService.retrieveDataset('dataset-id')).resolves.toEqual(
      {
        content: defaultCsv,
        fileExtension: 'csv',
      },
    );

    const result = await useCase.confirmDatasetUpload('dataset-id');

    expect(result).toEqual({
      dataset_id: 'dataset-id',
      sample_count: 10,
      has_summary: false,
      has_class: false,
    });
  });

  it('returns metadata for a valid jsonl dataset', async () => {
    const jsonlContent = Array.from(
      { length: 10 },
      (_, i) => `{"document":"Question ${i + 1}","summary":"Answer ${i + 1}"}`,
    ).join('\n');
    const { useCase, datasetService } = setup();
    await datasetService.upload('dataset-id', jsonlContent, 'jsonl');

    await expect(datasetService.retrieveDataset('dataset-id')).resolves.toEqual(
      {
        content: jsonlContent,
        fileExtension: 'jsonl',
      },
    );

    const result = await useCase.confirmDatasetUpload('dataset-id');

    expect(result.has_summary).toBe(true);
    expect(result.sample_count).toBe(10);
  });

  it('rejects datasets with fewer than 10 samples', async () => {
    const content = `document\n"Question 1"\n"Question 2"`;
    const { useCase, datasetService } = setup();
    await datasetService.upload('dataset-id', content, 'csv');

    await expect(datasetService.retrieveDataset('dataset-id')).resolves.toEqual(
      {
        content,
        fileExtension: 'csv',
      },
    );

    await expect(useCase.confirmDatasetUpload('dataset-id')).rejects.toThrow(
      'Dataset must contain at least 10 samples. Found 2 samples',
    );
  });

  it('rejects malicious content', async () => {
    const content = `document\n${Array.from({ length: 10 }, () => '"<script>alert(1)</script>"').join('\n')}`;
    const { useCase, datasetService } = setup();
    await datasetService.upload('dataset-id', content, 'csv');

    await expect(datasetService.retrieveDataset('dataset-id')).resolves.toEqual(
      {
        content,
        fileExtension: 'csv',
      },
    );

    await expect(useCase.confirmDatasetUpload('dataset-id')).rejects.toThrow(
      'File contains potentially malicious content',
    );
  });

  it('propagates dataset not found errors', async () => {
    const { useCase, datasetService } = setup();

    await expect(datasetService.retrieveDataset('missing-id')).rejects.toThrow(
      'Dataset not found',
    );

    await expect(useCase.confirmDatasetUpload('missing-id')).rejects.toThrow(
      'Dataset not found',
    );
  });
});

const setup = () => {
  reset();
  registerTestInfrastructure();

  return {
    useCase: new ConfirmDatasetUploadUseCaseImpl(),
    datasetService: inject(tokenFakeDatasetService),
  };
};
