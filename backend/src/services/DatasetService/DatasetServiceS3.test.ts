import { PutObjectCommand } from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';
import { Dataset } from '../../models/Dataset';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { DatasetServiceImpl, tokenClientS3 } from './DatasetServiceS3';

describe('DatasetServiceS3', () => {
  describe('uploadDataset', () => {
    it('should upload CSV dataset to S3 with encryption', async () => {
      const { service, s3ClientMock } = setup();
      const content = 'document\n"What is AI?"';
      const dataset: Dataset = {
        samples: [{ document: 'What is AI?' }],
      };

      s3ClientMock.on(PutObjectCommand).resolves({});

      const result = await service.uploadDataset(content, 'csv', dataset);

      const putCalls = s3ClientMock.commandCalls(PutObjectCommand);
      expect(putCalls).toHaveLength(1);
      expect(putCalls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Body: content,
        ContentType: 'text/csv',
        ServerSideEncryption: 'AES256',
      });
      expect(putCalls[0].args[0].input.Key).toMatch(
        /^datasets\/[a-f0-9-]+\.csv$/,
      );

      expect(result.dataset_id).toMatch(/^[a-f0-9-]+$/);
      expect(result.sample_count).toBe(1);
      expect(result.has_summary).toBe(false);
      expect(result.has_class).toBe(false);
      expect(result.s3_key).toMatch(/^datasets\/[a-f0-9-]+\.csv$/);
    });

    it('should upload JSONL dataset to S3', async () => {
      const { service, s3ClientMock } = setup();
      const content = '{"document":"What is AI?"}';
      const dataset: Dataset = {
        samples: [{ document: 'What is AI?' }],
      };

      s3ClientMock.on(PutObjectCommand).resolves({});

      const result = await service.uploadDataset(content, 'jsonl', dataset);

      const putCalls = s3ClientMock.commandCalls(PutObjectCommand);
      expect(putCalls).toHaveLength(1);
      expect(putCalls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Body: content,
        ContentType: 'application/jsonl',
        ServerSideEncryption: 'AES256',
      });
      expect(result.s3_key).toMatch(/^datasets\/[a-f0-9-]+\.jsonl$/);
    });

    it('should detect has_summary correctly', async () => {
      const { service, s3ClientMock } = setup();
      const content = 'document,summary\n"What is AI?","AI explanation"';
      const dataset: Dataset = {
        samples: [{ document: 'What is AI?', summary: 'AI explanation' }],
      };

      s3ClientMock.on(PutObjectCommand).resolves({});

      const result = await service.uploadDataset(content, 'csv', dataset);

      expect(result.has_summary).toBe(true);
    });

    it('should detect has_class correctly', async () => {
      const { service, s3ClientMock } = setup();
      const content = 'document,class\n"What is AI?","technology"';
      const dataset: Dataset = {
        samples: [{ document: 'What is AI?', class_label: 'technology' }],
      };

      s3ClientMock.on(PutObjectCommand).resolves({});

      const result = await service.uploadDataset(content, 'csv', dataset);

      expect(result.has_class).toBe(true);
    });

    it('should handle dataset with multiple samples', async () => {
      const { service, s3ClientMock } = setup();
      const dataset: Dataset = {
        samples: [
          { document: 'Question 1' },
          { document: 'Question 2', summary: 'Answer 2' },
          { document: 'Question 3', class_label: 'category' },
        ],
      };

      s3ClientMock.on(PutObjectCommand).resolves({});

      const result = await service.uploadDataset('content', 'csv', dataset);

      expect(result.sample_count).toBe(3);
      expect(result.has_summary).toBe(true);
      expect(result.has_class).toBe(true);
    });

    it('should generate unique dataset IDs', async () => {
      const { service, s3ClientMock } = setup();
      const dataset: Dataset = {
        samples: [{ document: 'Test' }],
      };

      s3ClientMock.on(PutObjectCommand).resolves({});

      const result1 = await service.uploadDataset('content', 'csv', dataset);
      const result2 = await service.uploadDataset('content', 'csv', dataset);

      expect(result1.dataset_id).not.toBe(result2.dataset_id);
    });
  });
});

const setup = () => {
  reset();
  registerTestInfrastructure();

  process.env.DATASET_BUCKET = 'test-bucket';

  const s3ClientMock = mockClient(inject(tokenClientS3));

  return {
    service: new DatasetServiceImpl(),
    s3ClientMock,
  };
};
