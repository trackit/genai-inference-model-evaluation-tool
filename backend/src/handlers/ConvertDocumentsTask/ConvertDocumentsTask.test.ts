import { register, reset } from '@trackit.io/di-container';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChunkingStrategy } from '../../models/DocumentConversion';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';
import { tokenDocumentConversionUseCase } from '../../useCases/DocumentConversion/DocumentConversionUseCase';

describe('ConvertDocumentsTask Handler', () => {
  const readUploadManifest = vi.fn();
  const execute = vi.fn();

  beforeEach(() => {
    reset();
    vi.clearAllMocks();
    register(tokenDatasetService, { useValue: { readUploadManifest } });
    register(tokenDocumentConversionUseCase, { useValue: { execute } });
  });

  it('resolves documents from the manifest and returns the converted key', async () => {
    const { handler } = await import('./ConvertDocumentsTask');
    readUploadManifest.mockResolvedValue({
      max_total_bytes: 1000,
      files: [
        {
          document_id: 'doc1',
          filename: 'a.pdf',
          file_type: 'pdf',
          s3_key: 'k1',
          size_bytes: 100,
        },
        {
          document_id: 'doc2',
          filename: 'b.docx',
          file_type: 'docx',
          s3_key: 'k2',
          size_bytes: 100,
        },
      ],
    });
    execute.mockResolvedValue('datasets/ds1/ds1-converted.jsonl');

    const result = await handler({
      datasetId: 'ds1',
      taskType: 'summarization',
      chunkingStrategy: ChunkingStrategy.CHAPTER,
    });

    expect(execute).toHaveBeenCalledWith({
      dataset_id: 'ds1',
      documents: [
        { document_id: 'doc1', file_type: 'pdf' },
        { document_id: 'doc2', file_type: 'docx' },
      ],
      chunking_strategy: ChunkingStrategy.CHAPTER,
    });
    expect(result).toEqual({
      datasetId: 'ds1',
      taskType: 'summarization',
      convertedDatasetArtifactKey: 'datasets/ds1/ds1-converted.jsonl',
    });
  });

  it('throws when the manifest is missing', async () => {
    const { handler } = await import('./ConvertDocumentsTask');
    readUploadManifest.mockResolvedValue(null);

    await expect(
      handler({
        datasetId: 'ds1',
        taskType: 'summarization',
        chunkingStrategy: ChunkingStrategy.CHAPTER,
      }),
    ).rejects.toThrow(/manifest/i);
  });
});
