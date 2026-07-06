import { GetObjectCommand } from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BasicError } from '../../errors';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';
import { PreprocessingChunkReaderS3 } from './PreprocessingChunkReader';

describe('PreprocessingChunkReaderS3', () => {
  it('reads chunks from the configured dataset bucket', async () => {
    const { reader, s3ClientMock } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => readFixture(),
      } as never,
    });

    const chunks = await reader.readChunks('preprocessing/demo/chunks.jsonl');

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({
      chunk_id: 'chunk-001',
      document_id: 'doc-001',
      source_filename: 'quarterly-report.pdf',
      chunk_index: 0,
      metadata: {
        section_title: 'Executive Summary',
        page_start: 1,
        page_end: 1,
      },
    });
    expect(
      s3ClientMock.commandCalls(GetObjectCommand)[0].args[0].input,
    ).toEqual({
      Bucket: 'test-bucket',
      Key: 'preprocessing/demo/chunks.jsonl',
    });
  });

  it('skips blank lines in the JSONL artifact', async () => {
    const { reader, s3ClientMock } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => `${readFixture()}\n\n`,
      } as never,
    });

    await expect(
      reader.readChunks('preprocessing/demo/chunks.jsonl'),
    ).resolves.toHaveLength(3);
  });

  it('rejects a missing chunk artifact key', async () => {
    const { reader } = setup();

    await expect(reader.readChunks('   ')).rejects.toMatchObject({
      code: 'CHUNK_ARTIFACT_KEY_REQUIRED',
    });
  });

  it('throws CHUNK_ARTIFACT_NOT_FOUND when S3 does not have the artifact', async () => {
    const { reader, s3ClientMock } = setup();
    const notFound = new Error('Not found');
    notFound.name = 'NoSuchKey';
    s3ClientMock.on(GetObjectCommand).rejects(notFound);

    await expect(
      reader.readChunks('preprocessing/missing/chunks.jsonl'),
    ).rejects.toMatchObject({
      code: 'CHUNK_ARTIFACT_NOT_FOUND',
    });
  });

  it('rejects empty chunk artifacts', async () => {
    const { reader, s3ClientMock } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => '\n\n',
      } as never,
    });

    await expect(
      reader.readChunks('preprocessing/demo/chunks.jsonl'),
    ).rejects.toMatchObject({
      code: 'EMPTY_CHUNK_ARTIFACT',
    });
  });

  it('rejects malformed JSONL with the failing line number', async () => {
    const { reader, s3ClientMock } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => `${validChunkLine()}\n{not-json}`,
      } as never,
    });

    await expect(
      reader.readChunks('preprocessing/demo/chunks.jsonl'),
    ).rejects.toThrow('Error parsing chunk artifact line 2: Invalid JSON');
  });

  it('rejects chunk rows that miss required fields', async () => {
    const { reader, s3ClientMock } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () =>
          JSON.stringify({
            chunk_id: 'chunk-001',
            document_id: 'doc-001',
            source_filename: 'source.pdf',
            chunk_index: 0,
          }),
      } as never,
    });

    await expect(
      reader.readChunks('preprocessing/demo/chunks.jsonl'),
    ).rejects.toThrow('Invalid chunk artifact line 1: "text"');
  });

  it('raises BasicError for invalid chunk artifacts', async () => {
    const { reader, s3ClientMock } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () =>
          JSON.stringify({
            chunk_id: 'chunk-001',
            document_id: 'doc-001',
            source_filename: 'source.pdf',
            chunk_index: -1,
            text: 'Chunk text',
          }),
      } as never,
    });

    await expect(
      reader.readChunks('preprocessing/demo/chunks.jsonl'),
    ).rejects.toThrow(BasicError);
  });
});

function setup() {
  reset();
  registerTestInfrastructure();
  process.env.DATASET_BUCKET = 'test-bucket';

  const s3ClientMock = mockClient(inject(tokenClientS3));

  return {
    reader: new PreprocessingChunkReaderS3(),
    s3ClientMock,
  };
}

function readFixture(): string {
  return readFileSync(
    new URL('../../test/fixtures/preprocessing-chunks.jsonl', import.meta.url),
    'utf8',
  );
}

function validChunkLine(): string {
  return JSON.stringify({
    chunk_id: 'chunk-001',
    document_id: 'doc-001',
    source_filename: 'source.pdf',
    chunk_index: 0,
    text: 'Chunk text',
  });
}
