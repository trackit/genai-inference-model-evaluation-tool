import {
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';

import { randomUUID } from 'crypto';
import { BasicError, BasicErrorType } from '../../errors/BasicError';
import { MAX_DATASET_BYTES } from '../../models/Dataset';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import {
  convertedDatasetS3Key,
  datasetS3Key,
  DatasetServiceImpl,
  documentS3Key,
  tokenClientS3,
} from './DatasetServiceS3';

const DATASET_ID = randomUUID();

describe('DatasetServiceImpl', () => {
  describe('retrieveDataset', () => {
    it('returns csv content when the csv object exists', async () => {
      const { service, s3ClientMock } = setup();
      s3ClientMock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: async () => 'document\n"Question 1"',
        } as never,
      } as never);

      const result = await service.retrieveDataset('dataset-id');

      expect(result.fileExtension).toBe('csv');
      expect(result.content).toContain('Question 1');
    });

    it('falls back to jsonl when csv is missing', async () => {
      const { service, s3ClientMock } = setup();
      const notFound = new Error('Not found');
      notFound.name = 'NoSuchKey';

      s3ClientMock
        .on(GetObjectCommand, { Key: datasetS3Key('dataset-id', 'csv') })
        .rejects(notFound)
        .on(GetObjectCommand, { Key: datasetS3Key('dataset-id', 'jsonl') })
        .resolves({
          Body: {
            transformToString: async () => '{"document":"Question 1"}',
          } as never,
        } as never);

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
            s3_key: documentS3Key('dataset-id', 'doc-1', 'pdf'),
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
        service.getUploadedObjectSize(
          documentS3Key('dataset-id', 'doc-1', 'pdf'),
        ),
      ).resolves.toBe(4096);
    });

    it('throws UPLOAD_INCOMPLETE when object is missing', async () => {
      const { service, s3ClientMock } = setup();
      const notFound = new Error('Not found');
      notFound.name = 'NoSuchKey';
      s3ClientMock.on(HeadObjectCommand).rejects(notFound);

      await expect(
        service.getUploadedObjectSize(
          documentS3Key('dataset-id', 'missing', 'pdf'),
        ),
      ).rejects.toThrow(BasicError);
    });
  });

  describe('preprocessing dataset artifacts', () => {
    it('reads converted dataset rows from a converted artifact key', async () => {
      const { service, s3ClientMock } = setup();
      s3ClientMock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: async () => summarizationConvertedArtifact(),
        } as never,
      } as never);

      const rows = await service.readConvertedDatasetRows(
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      );

      expect(rows).toEqual([
        {
          document_id: 'demo-dataset',
          chunk_id: 'demo-dataset-0',
          document: 'First document chunk',
        },
      ]);
      expect(
        s3ClientMock.commandCalls(GetObjectCommand)[0].args[0].input,
      ).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'datasets/demo-dataset/demo-dataset-converted.jsonl',
      });
    });

    it('writes synthetic dataset rows to the expected artifact key', async () => {
      const { service, s3ClientMock } = setup();
      s3ClientMock.on(PutObjectCommand).resolves({} as never);

      const result = await service.writeSyntheticDataset('demo-dataset', [
        {
          document_id: 'demo-dataset',
          chunk_id: 'demo-dataset-0',
          text: 'First document chunk',
          summary: 'Summary one',
          status: 'completed',
          model_id: 'test-model',
        },
      ]);

      expect(result.syntheticDatasetArtifactKey).toBe(
        'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      );
      expect(
        s3ClientMock.commandCalls(PutObjectCommand)[0].args[0].input,
      ).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
        Body: '{"document_id":"demo-dataset","chunk_id":"demo-dataset-0","text":"First document chunk","summary":"Summary one","status":"completed","model_id":"test-model"}\n',
        ContentType: 'application/jsonl',
        ServerSideEncryption: 'AES256',
      });
    });

    it('reads synthetic dataset rows from a synthetic artifact key', async () => {
      const { service, s3ClientMock } = setup();
      s3ClientMock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: async () => summarizationSyntheticArtifact(),
        } as never,
      } as never);

      const rows = await service.readSyntheticDatasetRows(
        'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      );

      expect(rows[0]).toEqual({
        document_id: 'demo-dataset',
        chunk_id: 'demo-dataset-0',
        text: 'First document chunk',
        summary: 'Summary one',
        status: 'completed',
      });
    });

    it('writes structured dataset samples to the final evaluator key', async () => {
      const { service, s3ClientMock } = setup();
      s3ClientMock.on(PutObjectCommand).resolves({} as never);

      const result = await service.writeStructuredDataset('demo-dataset', [
        {
          document: 'First document chunk',
          summary: 'Summary one',
        },
      ]);

      expect(result.structuredDatasetArtifactKey).toBe(
        'datasets/demo-dataset/demo-dataset.jsonl',
      );
      expect(
        s3ClientMock.commandCalls(PutObjectCommand)[0].args[0].input,
      ).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'datasets/demo-dataset/demo-dataset.jsonl',
        Body: '{"document":"First document chunk","summary":"Summary one"}\n',
        ContentType: 'application/jsonl',
        ServerSideEncryption: 'AES256',
      });
    });

    it('maps missing converted artifacts to converted-artifact errors', async () => {
      const { service, s3ClientMock } = setup();
      const notFound = new Error('Not found');
      notFound.name = 'NoSuchKey';
      s3ClientMock.on(GetObjectCommand).rejects(notFound);

      await expect(
        service.readConvertedDatasetRows(
          'datasets/missing/missing-converted.jsonl',
        ),
      ).rejects.toMatchObject({
        code: 'CONVERTED_DATASET_ARTIFACT_NOT_FOUND',
      });
    });

    it('rejects invalid converted JSONL rows', async () => {
      const { service, s3ClientMock } = setup();
      s3ClientMock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: async () => '{"chunk_id":"missing-fields"}',
        } as never,
      } as never);

      await expect(
        service.readConvertedDatasetRows(
          'datasets/demo-dataset/demo-dataset-converted.jsonl',
        ),
      ).rejects.toMatchObject({
        code: 'INVALID_CONVERTED_DATASET_ARTIFACT_FORMAT',
      });
    });
  });

  describe('storeConversionJsonl', () => {
    it('uploads JSONL to the dataset bucket with the correct metadata', async () => {
      const { service, s3ClientMock } = setup();
      const convertedDatasetFileKey = convertedDatasetS3Key(DATASET_ID);
      const jsonl =
        '{"document_id":"doc-1","chunk_id":"doc-1-0","document":"hello"}\n';
      s3ClientMock.on(PutObjectCommand).resolves({});

      const result = await service.storeConversionJsonl(DATASET_ID, jsonl);

      expect(result).toBe(convertedDatasetFileKey);
      const calls = s3ClientMock.commandCalls(PutObjectCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: convertedDatasetFileKey,
        Body: jsonl,
        ContentType: 'application/jsonl',
        ServerSideEncryption: 'AES256',
      });
    });

    it('returns the S3 key even when upload resolves with empty output', async () => {
      const { service, s3ClientMock } = setup();
      const jsonl =
        '{"document_id":"doc-2","chunk_id":"doc-2-0","document":"world"}\n';
      s3ClientMock.on(PutObjectCommand).resolves({});

      const result = await service.storeConversionJsonl(DATASET_ID, jsonl);

      expect(result).toBe(convertedDatasetS3Key(DATASET_ID));
    });
  });

  describe('fetchRawContent', () => {
    it('fetches raw content from S3 and returns a Buffer', async () => {
      const { service, s3ClientMock } = setup();

      const documentId = randomUUID();
      const content = Buffer.from('raw document content');

      s3ClientMock.on(GetObjectCommand).resolves({
        Body: {
          transformToByteArray: async () => new Uint8Array(content),
        } as never,
      });

      const result = await service.fetchRawContent(
        DATASET_ID,
        documentId,
        'pdf',
      );

      expect(result).toEqual(content);

      const calls = s3ClientMock.commandCalls(GetObjectCommand);

      expect(calls).toHaveLength(1);

      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: documentS3Key(DATASET_ID, documentId, 'pdf'),
      });
    });

    it.each([['pdf'], ['doc'], ['docx']] as const)(
      'builds the correct key for %s file type',
      async (fileType) => {
        const { service, s3ClientMock } = setup();
        const documentId = randomUUID();

        s3ClientMock.on(GetObjectCommand).resolves({
          Body: {
            transformToByteArray: async () =>
              new Uint8Array(Buffer.from('content')),
          } as never,
        });

        await service.fetchRawContent(DATASET_ID, documentId, fileType);

        const call = s3ClientMock.commandCalls(GetObjectCommand)[0];

        expect(call.args[0].input.Key).toBe(
          documentS3Key(DATASET_ID, documentId, fileType),
        );
      },
    );

    it('propagates S3 errors', async () => {
      const { service, s3ClientMock } = setup();
      const documentId = randomUUID();
      const error = new Error('Access denied');

      s3ClientMock.on(GetObjectCommand).rejects(error);

      await expect(
        service.fetchRawContent(DATASET_ID, documentId, 'pdf'),
      ).rejects.toBe(error);
    });

    it('throws when S3 Body is missing', async () => {
      const { service, s3ClientMock } = setup();
      const documentId = randomUUID();

      s3ClientMock.on(GetObjectCommand).resolves({
        Body: undefined,
      });

      await expect(
        service.fetchRawContent(DATASET_ID, documentId, 'pdf'),
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
        service.fetchRawContent(DATASET_ID, 'missing', 'pdf'),
      ).rejects.toMatchObject(
        new BasicError(
          BasicErrorType.NOT_FOUND,
          'DOCUMENT_NOT_FOUND',
          'Document not found',
          `No document found with key: ${documentS3Key(DATASET_ID, 'missing', 'pdf')}`,
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

function summarizationConvertedArtifact(): string {
  return JSON.stringify({
    document_id: 'demo-dataset',
    chunk_id: 'demo-dataset-0',
    document: 'First document chunk',
  });
}

function summarizationSyntheticArtifact(): string {
  return JSON.stringify({
    document_id: 'demo-dataset',
    chunk_id: 'demo-dataset-0',
    text: 'First document chunk',
    summary: 'Summary one',
    status: 'completed',
  });
}
