import { GetObjectCommand, GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { Readable } from 'stream';
import { describe, expect, it } from 'vitest';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';
import { DocumentConversionServiceImpl } from './DocumentConversionServiceS3';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal SDK-compatible streaming body from raw bytes.
 * Attaches the `transformToByteArray` helper that the service calls internally.
 */
function mockS3Body(content: Buffer): GetObjectCommandOutput['Body'] {
  const readable = new Readable({
    read() {
      this.push(content);
      this.push(null);
    },
  });

  return Object.assign(readable, {
    transformToByteArray: async () => new Uint8Array(content),
    transformToString: async () => content.toString('utf-8'),
  }) as unknown as GetObjectCommandOutput['Body'];
}

const DATASET_ID = 'a1b2c3d4-0000-0000-0000-000000000001';
const DOCUMENT_ID = 'e5f6a7b8-0000-0000-0000-000000000002';

const setup = () => {
  reset();
  registerTestInfrastructure();

  process.env.DATASET_BUCKET = 'test-bucket';

  const s3Mock = mockClient(inject(tokenClientS3));

  return {
    service: new DocumentConversionServiceImpl(),
    s3Mock,
  };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocumentConversionServiceS3', () => {
  describe('fetchDocument', () => {
    it('calls GetObject with the correct S3 key and bucket', async () => {
      const { service, s3Mock } = setup();

      s3Mock.on(GetObjectCommand).resolves({
        Body: mockS3Body(Buffer.from('%PDF-1.4 fake pdf content')),
      });

      await service.fetchDocument(DATASET_ID, DOCUMENT_ID, 'pdf');

      const calls = s3Mock.commandCalls(GetObjectCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: `documents/${DATASET_ID}/${DOCUMENT_ID}.pdf`,
      });
    });

    it('returns the raw content as a Buffer with the correct bytes', async () => {
      const { service, s3Mock } = setup();
      const rawBytes = Buffer.from('%PDF-1.4 fake pdf content');

      s3Mock.on(GetObjectCommand).resolves({ Body: mockS3Body(rawBytes) });

      const result = await service.fetchDocument(DATASET_ID, DOCUMENT_ID, 'pdf');

      expect(result.rawContent).toEqual(rawBytes);
    });

    it('returns the correct metadata on the fetched document', async () => {
      const { service, s3Mock } = setup();

      s3Mock.on(GetObjectCommand).resolves({
        Body: mockS3Body(Buffer.from('content')),
      });

      const result = await service.fetchDocument(DATASET_ID, DOCUMENT_ID, 'pdf');

      expect(result.documentId).toBe(DOCUMENT_ID);
      expect(result.datasetId).toBe(DATASET_ID);
      expect(result.fileType).toBe('pdf');
    });

    it.each([['pdf'], ['doc'], ['docx']] as const)(
      'builds the correct S3 key for fileType=%s',
      async (fileType) => {
        const { service, s3Mock } = setup();

        s3Mock.on(GetObjectCommand).resolves({
          Body: mockS3Body(Buffer.from('content')),
        });

        await service.fetchDocument(DATASET_ID, DOCUMENT_ID, fileType);

        const calls = s3Mock.commandCalls(GetObjectCommand);
        expect(calls[0].args[0].input.Key).toBe(
          `documents/${DATASET_ID}/${DOCUMENT_ID}.${fileType}`,
        );
      },
    );

    it('propagates S3 access errors', async () => {
      const { service, s3Mock } = setup();

      s3Mock.on(GetObjectCommand).rejects(
        Object.assign(new Error('Access Denied'), { name: 'AccessDenied' }),
      );

      await expect(
        service.fetchDocument(DATASET_ID, DOCUMENT_ID, 'pdf'),
      ).rejects.toThrow('Access Denied');
    });

    it('propagates NoSuchKey without masking it', async () => {
      const { service, s3Mock } = setup();

      s3Mock.on(GetObjectCommand).rejects(
        Object.assign(new Error('The specified key does not exist.'), {
          name: 'NoSuchKey',
        }),
      );

      await expect(
        service.fetchDocument(DATASET_ID, DOCUMENT_ID, 'pdf'),
      ).rejects.toThrow('The specified key does not exist.');
    });
  });
});
