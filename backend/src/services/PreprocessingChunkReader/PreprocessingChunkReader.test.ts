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
  it('reads converted rows from the configured dataset bucket', async () => {
    const { reader, s3ClientMock } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => readFixture(),
      } as never,
    });

    const rows = await reader.readConvertedRows(
      'datasets/demo-dataset/demo-dataset-converted.jsonl',
    );

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-0',
      text: 'Revenue increased by 18 percent in Q2 due to growth in enterprise subscriptions and improved renewal rates.',
      summary: '',
    });
    expect(
      s3ClientMock.commandCalls(GetObjectCommand)[0].args[0].input,
    ).toEqual({
      Bucket: 'test-bucket',
      Key: 'datasets/demo-dataset/demo-dataset-converted.jsonl',
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
      reader.readConvertedRows(
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      ),
    ).resolves.toHaveLength(3);
  });

  it('rejects a missing converted dataset artifact key', async () => {
    const { reader } = setup();

    await expect(reader.readConvertedRows('   ')).rejects.toMatchObject({
      code: 'CONVERTED_DATASET_ARTIFACT_KEY_REQUIRED',
    });
  });

  it('throws CONVERTED_DATASET_ARTIFACT_NOT_FOUND when S3 does not have the artifact', async () => {
    const { reader, s3ClientMock } = setup();
    const notFound = new Error('Not found');
    notFound.name = 'NoSuchKey';
    s3ClientMock.on(GetObjectCommand).rejects(notFound);

    await expect(
      reader.readConvertedRows('datasets/missing/missing-converted.jsonl'),
    ).rejects.toMatchObject({
      code: 'CONVERTED_DATASET_ARTIFACT_NOT_FOUND',
    });
  });

  it('rejects empty converted dataset artifacts', async () => {
    const { reader, s3ClientMock } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => '\n\n',
      } as never,
    });

    await expect(
      reader.readConvertedRows(
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      ),
    ).rejects.toMatchObject({
      code: 'EMPTY_CONVERTED_DATASET_ARTIFACT',
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
      reader.readConvertedRows(
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      ),
    ).rejects.toThrow(
      'Error parsing converted dataset artifact line 2: Invalid JSON',
    );
  });

  it('rejects converted rows that miss required fields', async () => {
    const { reader, s3ClientMock } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () =>
          JSON.stringify({
            document_id: 'demo-dataset',
            chunk_id: 'demo-dataset-0',
            summary: '',
          }),
      } as never,
    });

    await expect(
      reader.readConvertedRows(
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      ),
    ).rejects.toThrow('Invalid converted dataset artifact line 1: "text"');
  });

  it('allows classification converted rows with an empty class placeholder', async () => {
    const { reader, s3ClientMock } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () =>
          JSON.stringify({
            document_id: 'demo-dataset',
            chunk_id: 'demo-dataset-0',
            text: 'Chunk text',
            class: '',
          }),
      } as never,
    });

    await expect(
      reader.readConvertedRows(
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      ),
    ).resolves.toEqual([
      {
        document_id: 'demo-dataset',
        chunk_id: 'demo-dataset-0',
        text: 'Chunk text',
        class: '',
      },
    ]);
  });

  it('raises BasicError when a converted row has neither summary nor class', async () => {
    const { reader, s3ClientMock } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () =>
          JSON.stringify({
            document_id: 'demo-dataset',
            chunk_id: 'demo-dataset-0',
            text: 'Chunk text',
          }),
      } as never,
    });

    await expect(
      reader.readConvertedRows(
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      ),
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
    document_id: 'demo-dataset',
    chunk_id: 'demo-dataset-0',
    text: 'Chunk text',
    summary: '',
  });
}
