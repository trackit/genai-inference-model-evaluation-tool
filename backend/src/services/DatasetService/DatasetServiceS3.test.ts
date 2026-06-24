import { GetObjectCommand } from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';

import { BasicError } from '../../errors/BasicError';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { DatasetServiceImpl, tokenClientS3 } from './DatasetServiceS3';

describe('DatasetServiceImpl', () => {
  describe('retrieveDataset', () => {
    it('returns csv content when the csv object exists', async () => {
      const { service, s3ClientMock } = setup();
      s3ClientMock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: async () => 'document\n"Question 1"',
        } as never,
      });

      const result = await service.retrieveDataset('dataset-id');

      expect(result.fileExtension).toBe('csv');
      expect(result.content).toContain('Question 1');
    });

    it('falls back to jsonl when csv is missing', async () => {
      const { service, s3ClientMock } = setup();
      const notFound = new Error('Not found');
      notFound.name = 'NoSuchKey';

      s3ClientMock
        .on(GetObjectCommand, { Key: 'datasets/dataset-id.csv' })
        .rejects(notFound)
        .on(GetObjectCommand, { Key: 'datasets/dataset-id.jsonl' })
        .resolves({
          Body: {
            transformToString: async () => '{"document":"Question 1"}',
          } as never,
        });

      const result = await service.retrieveDataset('dataset-id');

      expect(result.fileExtension).toBe('jsonl');
    });

    it('throws DATASET_NOT_FOUND when neither object exists', async () => {
      const { service, s3ClientMock } = setup();
      const notFound = new Error('Not found');
      notFound.name = 'NoSuchKey';
      s3ClientMock.on(GetObjectCommand).rejects(notFound);

      await expect(service.retrieveDataset('missing-id')).rejects.toThrow(
        BasicError,
      );
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
