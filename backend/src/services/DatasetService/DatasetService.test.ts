import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dataset } from '../../models/Dataset';
import { DatasetServiceImpl } from './DatasetService';

vi.mock('@aws-sdk/client-s3');

describe('DatasetService', () => {
  let service: DatasetServiceImpl;
  let mockS3Send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Send = vi.fn().mockResolvedValue({});
    vi.spyOn(S3Client.prototype, 'send').mockImplementation(mockS3Send);
    service = new DatasetServiceImpl('test-bucket', 'us-east-1');
  });

  describe('uploadDataset', () => {
    it('should upload CSV dataset to S3 with encryption', async () => {
      const content = 'prompt\n"What is AI?"';
      const dataset: Dataset = {
        samples: [{ prompt: 'What is AI?' }],
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
      const content = '{"prompt":"What is AI?"}';
      const dataset: Dataset = {
        samples: [{ prompt: 'What is AI?' }],
      };

      const result = await service.uploadDataset(content, 'jsonl', dataset);

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      expect(result.s3_key).toMatch(/^datasets\/[a-f0-9-]+\.jsonl$/);
    });

    it('should detect has_summary correctly', async () => {
      const content = 'prompt,summary\n"What is AI?","AI explanation"';
      const dataset: Dataset = {
        samples: [{ prompt: 'What is AI?', summary: 'AI explanation' }],
      };

      const result = await service.uploadDataset(content, 'csv', dataset);

      expect(result.has_summary).toBe(true);
    });

    it('should detect has_class correctly', async () => {
      const content = 'prompt,class\n"What is AI?","technology"';
      const dataset: Dataset = {
        samples: [{ prompt: 'What is AI?', class_label: 'technology' }],
      };

      const result = await service.uploadDataset(content, 'csv', dataset);

      expect(result.has_class).toBe(true);
    });

    it('should handle dataset with multiple samples', async () => {
      const dataset: Dataset = {
        samples: [
          { prompt: 'Question 1' },
          { prompt: 'Question 2', summary: 'Answer 2' },
          { prompt: 'Question 3', class_label: 'category' },
        ],
      };

      const result = await service.uploadDataset('content', 'csv', dataset);

      expect(result.sample_count).toBe(3);
      expect(result.has_summary).toBe(true);
      expect(result.has_class).toBe(true);
    });

    it('should generate unique dataset IDs', async () => {
      const dataset: Dataset = {
        samples: [{ prompt: 'Test' }],
      };

      const result1 = await service.uploadDataset('content', 'csv', dataset);
      const result2 = await service.uploadDataset('content', 'csv', dataset);

      expect(result1.dataset_id).not.toBe(result2.dataset_id);
    });
  });
});
