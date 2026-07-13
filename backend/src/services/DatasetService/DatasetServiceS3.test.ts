import {
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';

import { MAX_DATASET_BYTES } from '../../models/Dataset';
import { BasicError, BasicErrorType } from '../../errors/BasicError';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { DatasetServiceImpl, tokenClientS3 } from './DatasetServiceS3';

const DATASET_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

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
        .on(GetObjectCommand, { Key: 'datasets/dataset-id/dataset-id.csv' })
        .rejects(notFound)
        .on(GetObjectCommand, { Key: 'datasets/dataset-id/dataset-id.jsonl' })
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
            s3_key: 'datasets/dataset-id/doc-1.pdf',
            size_bytes: 1024,
          },
        ],
      };

      s3ClientMock.on(PutObjectCommand).resolves({});

      await service.writeUploadManifest('dataset-id', manifest);

      const call = s3ClientMock.commandCalls(PutObjectCommand)[0];
      expect(s3ClientMock.commandCalls(PutObjectCommand)).toHaveLength(1);
      expect(call.args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'datasets/dataset-id/.upload-manifest.json',
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
        service.getUploadedObjectSize('datasets/dataset-id/doc-1.pdf'),
      ).resolves.toBe(4096);
    });

    it('throws UPLOAD_INCOMPLETE when object is missing', async () => {
      const { service, s3ClientMock } = setup();
      const notFound = new Error('Not found');
      notFound.name = 'NoSuchKey';
      s3ClientMock.on(HeadObjectCommand).rejects(notFound);

      await expect(
        service.getUploadedObjectSize('datasets/dataset-id/missing.pdf'),
      ).rejects.toThrow(BasicError);
    });
  });
  describe('storeConversionJsonl', () => {
    it('uploads JSONL to the dataset bucket with the correct metadata', async () => {
      const { service, s3ClientMock } = setup();
      const convertedDatasetFileKey = `datasets/${DATASET_ID}/${DATASET_ID}-converted.jsonl`;
      const jsonl =
        '{"document_id":"doc-1","chunk_id":"doc-1-0","document":"hello"}\n';
      s3ClientMock.on(PutObjectCommand).resolves({});

      const result = await service.storeConversionJsonl(
        convertedDatasetFileKey,
        jsonl,
      );

      expect(result).toBe(convertedDatasetFileKey);
      const calls = s3ClientMock.commandCalls(PutObjectCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: `datasets/${DATASET_ID}/${DATASET_ID}-converted.jsonl`,
        Body: jsonl,
        ContentType: 'application/jsonl',
        ServerSideEncryption: 'AES256',
      });
    });

    it('returns the S3 key even when upload resolves with empty output', async () => {
      const { service, s3ClientMock } = setup();
      const convertedDatasetFileKey = `datasets/${DATASET_ID}/${DATASET_ID}-converted.jsonl`;
      const jsonl =
        '{"document_id":"doc-2","chunk_id":"doc-2-0","document":"world"}\n';
      s3ClientMock.on(PutObjectCommand).resolves({});

      const result = await service.storeConversionJsonl(
        convertedDatasetFileKey,
        jsonl,
      );

      expect(result).toBe(convertedDatasetFileKey);
    });
  });

  describe('fetchRawContent', () => {
    it('fetches raw content from S3 and returns a Buffer', async () => {
      const { service, s3ClientMock } = setup();

      const content = Buffer.from('raw document content');

      s3ClientMock.on(GetObjectCommand).resolves({
        Body: {
          transformToByteArray: async () => new Uint8Array(content),
        } as never,
      });

      const result = await service.fetchRawContent(
        `datasets/${DATASET_ID}/document-id.pdf`,
      );

      expect(result).toEqual(content);

      const calls = s3ClientMock.commandCalls(GetObjectCommand);

      expect(calls).toHaveLength(1);

      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: `datasets/${DATASET_ID}/document-id.pdf`,
      });
    });

    it.each([['pdf'], ['doc'], ['docx']] as const)(
      'builds the correct key for %s file type',
      async (fileType) => {
        const { service, s3ClientMock } = setup();

        s3ClientMock.on(GetObjectCommand).resolves({
          Body: {
            transformToByteArray: async () =>
              new Uint8Array(Buffer.from('content')),
          } as never,
        });

        await service.fetchRawContent(
          `datasets/${DATASET_ID}/document-id.${fileType}`,
        );

        const call = s3ClientMock.commandCalls(GetObjectCommand)[0];

        expect(call.args[0].input.Key).toBe(
          `datasets/${DATASET_ID}/document-id.${fileType}`,
        );
      },
    );

    it('propagates S3 errors', async () => {
      const { service, s3ClientMock } = setup();

      const error = new Error('Access denied');

      s3ClientMock.on(GetObjectCommand).rejects(error);

      await expect(
        service.fetchRawContent(`datasets/${DATASET_ID}/document-id.pdf`),
      ).rejects.toBe(error);
    });

    it('throws when S3 Body is missing', async () => {
      const { service, s3ClientMock } = setup();

      s3ClientMock.on(GetObjectCommand).resolves({
        Body: undefined,
      });

      await expect(
        service.fetchRawContent(`datasets/${DATASET_ID}/document-id.pdf`),
      ).rejects.toThrow('S3 returned no response body');
    });

    it('throws DOCUMENT_NOT_FOUND when the object does not exist', async () => {
      const { service, s3ClientMock } = setup();

      const error = new NoSuchKey({
        message: 'The specified key does not exist.',
        $metadata: {},
      });

      s3ClientMock.on(GetObjectCommand).rejects(error);

      await expect(
        service.fetchRawContent(`datasets/${DATASET_ID}/missing.pdf`),
      ).rejects.toMatchObject(
        new BasicError(
          BasicErrorType.NOT_FOUND,
          'DOCUMENT_NOT_FOUND',
          'Document not found',
          `No document found with key: datasets/${DATASET_ID}/missing.pdf`,
        ),
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
