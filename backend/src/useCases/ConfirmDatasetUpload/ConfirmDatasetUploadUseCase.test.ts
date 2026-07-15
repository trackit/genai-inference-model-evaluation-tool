import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';

import { BasicError } from '../../errors/BasicError';
import { MAX_DATASET_BYTES } from '../../models/Dataset';
import { tokenFakeDatasetService } from '../../services/DatasetService/FakeDatasetService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { ConfirmDatasetUploadUseCaseImpl } from './ConfirmDatasetUploadUseCase';

const defaultCsv = `document\n${Array.from({ length: 10 }, (_, i) => `"Question ${i + 1}"`).join('\n')}`;

describe('ConfirmDatasetUploadUseCase', () => {
  describe('structured datasets', () => {
    it('returns metadata for a valid csv dataset', async () => {
      const { useCase, datasetService } = setup();
      await datasetService.upload('dataset-id', defaultCsv, 'csv');

      const result = await useCase.confirmDatasetUpload('dataset-id', 'csv');

      expect(result).toEqual({
        dataset_type: 'structured',
        dataset_id: 'dataset-id',
        sample_count: 10,
        has_summary: false,
        has_class: false,
      });
    });

    it('returns metadata for a valid jsonl dataset', async () => {
      const jsonlContent = Array.from(
        { length: 10 },
        (_, i) =>
          `{"document":"Question ${i + 1}","summary":"Answer ${i + 1}"}`,
      ).join('\n');
      const { useCase, datasetService } = setup();
      await datasetService.upload('dataset-id', jsonlContent, 'jsonl');

      const result = await useCase.confirmDatasetUpload('dataset-id', 'jsonl');

      expect(result).toMatchObject({
        dataset_type: 'structured',
        has_summary: true,
        sample_count: 10,
      });
    });

    it('rejects datasets with fewer than 10 samples', async () => {
      const content = `document\n"Question 1"\n"Question 2"`;
      const { useCase, datasetService } = setup();
      await datasetService.upload('dataset-id', content, 'csv');

      await expect(
        useCase.confirmDatasetUpload('dataset-id', 'csv'),
      ).rejects.toThrow(
        'Dataset must contain at least 10 samples. Found 2 samples',
      );
    });
  });

  describe('document datasets', () => {
    it('returns metadata when all document files are uploaded', async () => {
      const { useCase, datasetService } = setup();
      const manifest = {
        max_total_bytes: MAX_DATASET_BYTES,
        files: [
          {
            document_id: 'doc-1',
            filename: 'report.pdf',
            file_type: 'pdf' as const,
            s3_key: 's3-key-1',
            size_bytes: 1024,
          },
          {
            document_id: 'doc-2',
            filename: 'notes.docx',
            file_type: 'docx' as const,
            s3_key: 's3-key-2',
            size_bytes: 2048,
          },
        ],
      };
      await datasetService.writeUploadManifest('dataset-id', manifest);
      datasetService.uploadDocument(manifest.files[0].s3_key, 1024);
      datasetService.uploadDocument(manifest.files[1].s3_key, 2048);

      const result = await useCase.confirmDatasetUpload('dataset-id');

      expect(result).toEqual({
        dataset_type: 'documents',
        dataset_id: 'dataset-id',
        file_count: 2,
        documents: [
          {
            filename: manifest.files[0].filename,
            file_type: manifest.files[0].file_type,
          },
          {
            filename: manifest.files[1].filename,
            file_type: manifest.files[1].file_type,
          },
        ],
      });
    });

    it('rejects when a manifest file is missing from storage', async () => {
      const { useCase, datasetService } = setup();
      await datasetService.writeUploadManifest('dataset-id', {
        max_total_bytes: MAX_DATASET_BYTES,
        files: [
          {
            document_id: 'doc-1',
            filename: 'report.pdf',
            file_type: 'pdf',
            s3_key: 's3-key',
            size_bytes: 1024,
          },
        ],
      });

      await expect(useCase.confirmDatasetUpload('dataset-id')).rejects.toThrow(
        BasicError,
      );
    });

    it('rejects when actual total size exceeds the dataset limit', async () => {
      const { useCase, datasetService } = setup();
      const manifest = {
        max_total_bytes: MAX_DATASET_BYTES,
        files: [
          {
            document_id: 'doc-1',
            filename: 'big.pdf',
            file_type: 'pdf' as const,
            s3_key: 's3-key-1',
            size_bytes: 150_000_000,
          },
          {
            document_id: 'doc-2',
            filename: 'also-big.pdf',
            file_type: 'pdf' as const,
            s3_key: 's3-key-2',
            size_bytes: 100_000_000,
          },
        ],
      };
      await datasetService.writeUploadManifest('dataset-id', manifest);
      datasetService.uploadDocument(manifest.files[0].s3_key, 150_000_000);
      datasetService.uploadDocument(manifest.files[1].s3_key, 100_000_000);

      await expect(useCase.confirmDatasetUpload('dataset-id')).rejects.toThrow(
        BasicError,
      );
    });
  });

  it('propagates dataset not found errors', async () => {
    const { useCase } = setup();

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
