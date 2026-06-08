import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { register, reset } from '@trackit.io/di-container';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dataset } from '../../models/Dataset';
import { DatasetServiceImpl, tokenS3Client } from './DatasetServiceS3';

describe('DatasetService', () => {
  let service: DatasetServiceImpl;
  let mockS3Send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reset();
    vi.clearAllMocks();

    mockS3Send = vi.fn().mockResolvedValue({});
    const mockS3Client = { send: mockS3Send } as unknown as S3Client;
    register(tokenS3Client, { useValue: mockS3Client });

    process.env.DATASET_BUCKET = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';

    service = new DatasetServiceImpl();
  });

  describe('uploadDataset', () => {
    it('should upload CSV dataset to S3 with encryption', async () => {
      const content = 'document\n"What is AI?"';
      const dataset: Dataset = {
        samples: [{ document: 'What is AI?' }],
      };

      const result = await service.uploadDataset(content, 'csv', dataset);

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      const callArg = mockS3Send.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(PutObjectCommand);

      expect(result.dataset_id).toMatch(/^[a-f0-9-]+$/);
      expect(result.sample_count).toBe(1);
      expect(result.has_summary).toBe(false);
      expect(result.has_class).toBe(false);
      expect(result.s3_key).toMatch(/^datasets\/[a-f0-9-]+\.csv$/);
    });

    it('should upload JSONL dataset to S3', async () => {
      const content = '{"document":"What is AI?"}';
      const dataset: Dataset = {
        samples: [{ document: 'What is AI?' }],
      };

      const result = await service.uploadDataset(content, 'jsonl', dataset);

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      expect(result.s3_key).toMatch(/^datasets\/[a-f0-9-]+\.jsonl$/);
    });

    it('should detect has_summary correctly', async () => {
      const content = 'document,summary\n"What is AI?","AI explanation"';
      const dataset: Dataset = {
        samples: [{ document: 'What is AI?', summary: 'AI explanation' }],
      };

      const result = await service.uploadDataset(content, 'csv', dataset);

      expect(result.has_summary).toBe(true);
    });

    it('should detect has_class correctly', async () => {
      const content = 'document,class\n"What is AI?","technology"';
      const dataset: Dataset = {
        samples: [{ document: 'What is AI?', class_label: 'technology' }],
      };

      const result = await service.uploadDataset(content, 'csv', dataset);

      expect(result.has_class).toBe(true);
    });

    it('should handle dataset with multiple samples', async () => {
      const dataset: Dataset = {
        samples: [
          { document: 'Question 1' },
          { document: 'Question 2', summary: 'Answer 2' },
          { document: 'Question 3', class_label: 'category' },
        ],
      };

      const result = await service.uploadDataset('content', 'csv', dataset);

      expect(result.sample_count).toBe(3);
      expect(result.has_summary).toBe(true);
      expect(result.has_class).toBe(true);
    });

    it('should generate unique dataset IDs', async () => {
      const dataset: Dataset = {
        samples: [{ document: 'Test' }],
      };

      const result1 = await service.uploadDataset('content', 'csv', dataset);
      const result2 = await service.uploadDataset('content', 'csv', dataset);

      expect(result1.dataset_id).not.toBe(result2.dataset_id);
    });
  });
});
