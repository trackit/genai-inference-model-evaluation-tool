import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';

import { BasicError } from '../../errors/BasicError';
import { MAX_DATASET_BYTES } from '../../models/Dataset';
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

  describe('writeUploadManifest', () => {
    it('writes manifest json to the dataset prefix', async () => {
      const { service, s3ClientMock } = setup();
      const manifest = {
        max_total_bytes: MAX_DATASET_BYTES,
        files: [
          {
            document_id: 'doc-1',
            filename: 'report.pdf',
            file_type: 'pdf' as const,
            s3_key: 'documents/dataset-id/doc-1.pdf',
            size_bytes: 1024,
          },
        ],
      };

      s3ClientMock.on(PutObjectCommand).resolves({});

      await service.writeUploadManifest('dataset-id', manifest);

      const call = s3ClientMock.commandCalls(PutObjectCommand)[0];
      expect(call.args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'documents/dataset-id/.upload-manifest.json',
        Body: JSON.stringify(manifest),
        ContentType: 'application/json',
        ServerSideEncryption: 'AES256',
      });
    });
  });

  describe('readUploadManifest', () => {
    it('returns parsed manifest when it exists', async () => {
      const { service, s3ClientMock } = setup();
      const manifest = {
        max_total_bytes: MAX_DATASET_BYTES,
        files: [],
      };

      s3ClientMock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: async () => JSON.stringify(manifest),
        } as never,
      });

      await expect(service.readUploadManifest('dataset-id')).resolves.toEqual(
        manifest,
      );
    });

    it('returns null when manifest is missing', async () => {
      const { service, s3ClientMock } = setup();
      const notFound = new Error('Not found');
      notFound.name = 'NoSuchKey';
      s3ClientMock.on(GetObjectCommand).rejects(notFound);

      await expect(
        service.readUploadManifest('dataset-id'),
      ).resolves.toBeNull();
    });
  });

  describe('getUploadedObjectSize', () => {
    it('returns content length from head object', async () => {
      const { service, s3ClientMock } = setup();
      s3ClientMock.on(HeadObjectCommand).resolves({ ContentLength: 4096 });

      await expect(
        service.getUploadedObjectSize('documents/dataset-id/doc-1.pdf'),
      ).resolves.toBe(4096);
    });

    it('throws UPLOAD_INCOMPLETE when object is missing', async () => {
      const { service, s3ClientMock } = setup();
      const notFound = new Error('Not found');
      notFound.name = 'NoSuchKey';
      s3ClientMock.on(HeadObjectCommand).rejects(notFound);

      await expect(
        service.getUploadedObjectSize('documents/dataset-id/missing.pdf'),
      ).rejects.toThrow(BasicError);
    });
  });

  describe('listDocuments', () => {
    it('returns array of document keys when documents exist', async () => {
      const { service, s3ClientMock } = setup();

      s3ClientMock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'documents/test-dataset/doc1.pdf' },
          { Key: 'documents/test-dataset/doc2.docx' },
          { Key: 'documents/test-dataset/doc3.doc' },
        ],
      });

      const result = await service.listDocuments('test-dataset');

      expect(result).toEqual([
        'documents/test-dataset/doc1.pdf',
        'documents/test-dataset/doc2.docx',
        'documents/test-dataset/doc3.doc',
      ]);
    });

    it('returns empty array when no documents exist', async () => {
      const { service, s3ClientMock } = setup();

      s3ClientMock.on(ListObjectsV2Command).resolves({
        Contents: [],
      });

      const result = await service.listDocuments('test-dataset');

      expect(result).toEqual([]);
    });

    it('returns empty array when Contents is undefined', async () => {
      const { service, s3ClientMock } = setup();

      s3ClientMock.on(ListObjectsV2Command).resolves({});

      const result = await service.listDocuments('test-dataset');

      expect(result).toEqual([]);
    });

    it('handles pagination correctly', async () => {
      const { service, s3ClientMock } = setup();

      // First page
      s3ClientMock
        .on(ListObjectsV2Command, {
          Bucket: 'test-bucket',
          Prefix: 'documents/test-dataset/',
        })
        .resolvesOnce({
          Contents: [
            { Key: 'documents/test-dataset/doc1.pdf' },
            { Key: 'documents/test-dataset/doc2.docx' },
          ],
          NextContinuationToken: 'token-1',
        })
        // Second page
        .resolvesOnce({
          Contents: [{ Key: 'documents/test-dataset/doc3.doc' }],
        });

      const result = await service.listDocuments('test-dataset');

      expect(result).toEqual([
        'documents/test-dataset/doc1.pdf',
        'documents/test-dataset/doc2.docx',
        'documents/test-dataset/doc3.doc',
      ]);
    });

    it('returns empty array when prefix does not exist (NotFound error)', async () => {
      const { service, s3ClientMock } = setup();

      const notFound = new Error('Not found');
      notFound.name = 'NotFound';
      s3ClientMock.on(ListObjectsV2Command).rejects(notFound);

      const result = await service.listDocuments('non-existent-dataset');

      expect(result).toEqual([]);
    });

    it('rethrows other S3 errors', async () => {
      const { service, s3ClientMock } = setup();

      const accessDenied = new Error('Access Denied');
      accessDenied.name = 'AccessDenied';
      s3ClientMock.on(ListObjectsV2Command).rejects(accessDenied);

      await expect(service.listDocuments('test-dataset')).rejects.toThrow(
        'Access Denied',
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
