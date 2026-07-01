import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';

import { tokenFakeDatasetService } from '../../services/DatasetService/FakeDatasetService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { InitializeDatasetUploadUseCaseImpl } from './InitializeDatasetUploadUseCase';

describe('InitializeDatasetUploadUseCase', () => {
  it('returns presigned upload details for csv files', async () => {
    const { useCase } = setup();
    const result = await useCase.initDatasetUpload('dataset.csv');

    expect(result.upload_url).toBe(
      `https://fake-s3.test/datasets/${result.dataset_id}.csv`,
    );
    expect(result.fields).toEqual({
      key: `datasets/${result.dataset_id}.csv`,
      Policy: 'fake-policy',
    });
    expect(result.dataset_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('returns presigned upload details for jsonl files', async () => {
    const { useCase } = setup();
    const result = await useCase.initDatasetUpload('dataset.jsonl');

    expect(result.fields.key).toBe(`datasets/${result.dataset_id}.jsonl`);
    expect(result.upload_url).toBe(
      `https://fake-s3.test/datasets/${result.dataset_id}.jsonl`,
    );
  });

  it('accepts uppercase extensions', async () => {
    const { useCase } = setup();
    const result = await useCase.initDatasetUpload('dataset.CSV');

    expect(result.fields.key).toBe(`datasets/${result.dataset_id}.csv`);
  });

  it('rejects unsupported extensions', async () => {
    const { useCase } = setup();
    await expect(useCase.initDatasetUpload('dataset.txt')).rejects.toThrow(
      'Invalid file format. Only CSV and JSONL files are supported',
    );
  });
});

const setup = () => {
  reset();
  registerTestInfrastructure();

  return {
    datasetService: inject(tokenFakeDatasetService),
    useCase: new InitializeDatasetUploadUseCaseImpl(),
  };
};
