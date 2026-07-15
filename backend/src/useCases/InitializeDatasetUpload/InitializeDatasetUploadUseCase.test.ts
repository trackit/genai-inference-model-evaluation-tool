import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it, vi } from 'vitest';

import { BasicError } from '../../errors/BasicError';
import { MAX_DATASET_BYTES } from '../../models/Dataset';
import { tokenFakeDatasetService } from '../../services/DatasetService/FakeDatasetService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import {
  documentS3Key,
  InitializeDatasetUploadUseCaseImpl,
} from './InitializeDatasetUploadUseCase';

describe('InitializeDatasetUploadUseCase', () => {
  it('returns presigned upload details for csv files', async () => {
    const { useCase, datasetService } = setup();
    const sizeBytes = 1024;
    const result = await useCase.initDatasetUpload([
      { filename: 'dataset.csv', size_bytes: sizeBytes },
    ]);

    expect(result.uploads).toHaveLength(1);
    expect(datasetService.presignedMaxBytes).toEqual([sizeBytes]);
    expect(result.uploads[0].upload_url).toBe(
      `https://fake-s3.test/datasets/${result.dataset_id}/${result.dataset_id}.csv`,
    );
    expect(result.uploads[0].fields).toEqual({
      key: `datasets/${result.dataset_id}/${result.dataset_id}.csv`,
      Policy: 'fake-policy',
    });
    expect(result.dataset_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('returns presigned upload details for jsonl files', async () => {
    const { useCase } = setup();
    const result = await useCase.initDatasetUpload([
      { filename: 'dataset.jsonl', size_bytes: 2048 },
    ]);

    expect(result.uploads[0].fields.key).toBe(
      `datasets/${result.dataset_id}/${result.dataset_id}.jsonl`,
    );
  });

  it('writes manifest with declared sizes and per-file presigned caps', async () => {
    const { useCase, datasetService } = setup();
    const bigSize = 199_229_440;
    const smallSize = 5_242_880;
    const result = await useCase.initDatasetUpload([
      { filename: 'report.pdf', size_bytes: bigSize },
      { filename: 'notes.docx', size_bytes: smallSize },
    ]);

    expect(result.uploads).toHaveLength(2);
    expect(datasetService.presignedMaxBytes).toEqual([bigSize, smallSize]);

    const manifest = datasetService.manifests.get(result.dataset_id);
    expect(manifest).toEqual({
      max_total_bytes: MAX_DATASET_BYTES,
      files: [
        {
          document_id: result.uploads[0].document_id,
          filename: 'report.pdf',
          file_type: 'pdf',
          s3_key: documentS3Key(
            result.dataset_id,
            result.uploads[0].document_id,
            'pdf',
          ),
          size_bytes: bigSize,
        },
        {
          document_id: result.uploads[1].document_id,
          filename: 'notes.docx',
          file_type: 'docx',
          s3_key: documentS3Key(
            result.dataset_id,
            result.uploads[1].document_id,
            'docx',
          ),
          size_bytes: smallSize,
        },
      ],
    });
    expect(result.uploads[0].fields.key).toBe(manifest!.files[0].s3_key);
    expect(datasetService.writeUploadManifest).toHaveBeenCalledWith(
      result.dataset_id,
      {
        max_total_bytes: MAX_DATASET_BYTES,
        files: [
          {
            document_id: result.uploads[0].document_id,
            filename: 'report.pdf',
            file_type: 'pdf',
            s3_key: documentS3Key(
              result.dataset_id,
              result.uploads[0].document_id,
              'pdf',
            ),
            size_bytes: bigSize,
          },
          {
            document_id: result.uploads[1].document_id,
            filename: 'notes.docx',
            file_type: 'docx',
            s3_key: documentS3Key(
              result.dataset_id,
              result.uploads[1].document_id,
              'docx',
            ),
            size_bytes: smallSize,
          },
        ],
      },
    );
  });

  it('rejects document uploads when declared total exceeds 200MB', async () => {
    const { useCase } = setup();
    await expect(
      useCase.initDatasetUpload([
        {
          filename: 'big.pdf',
          size_bytes: 150_000_000,
        },
        {
          filename: 'also-big.pdf',
          size_bytes: 100_000_000,
        },
      ]),
    ).rejects.toThrow(BasicError);
  });

  it('rejects csv/jsonl mixed with documents', async () => {
    const { useCase } = setup();
    await expect(
      useCase.initDatasetUpload([
        { filename: 'data.csv', size_bytes: 1024 },
        { filename: 'report.pdf', size_bytes: 1024 },
      ]),
    ).rejects.toMatchObject({
      code: 'DATASET_MIXED_WITH_DOCUMENTS',
    });
  });

  it('rejects empty file list', async () => {
    const { useCase } = setup();
    await expect(useCase.initDatasetUpload([])).rejects.toMatchObject({
      code: 'NO_FILES',
    });
  });
});

const setup = () => {
  reset();
  registerTestInfrastructure();
  const datasetService = inject(tokenFakeDatasetService);
  vi.spyOn(datasetService, 'writeUploadManifest');
  return {
    datasetService,
    useCase: new InitializeDatasetUploadUseCaseImpl(),
  };
};
