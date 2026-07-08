import { GetObjectCommand } from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';

import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';
import { SyntheticDatasetReaderS3 } from './SyntheticDatasetReader';

describe('SyntheticDatasetReaderS3', () => {
  it('reads synthetic rows from S3', async () => {
    const { reader, s3ClientMock } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => syntheticArtifact(),
      } as never,
    });

    const rows = await reader.readSyntheticRows(
      'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
    );

    expect(rows).toEqual([
      {
        document_id: 'demo-dataset',
        chunk_id: 'demo-dataset-0',
        text: 'Chunk text',
        summary: 'Generated summary',
        status: 'completed',
      },
    ]);
    expect(
      s3ClientMock.commandCalls(GetObjectCommand)[0].args[0].input,
    ).toEqual({
      Bucket: 'test-bucket',
      Key: 'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
    });
  });

  it('rejects empty artifact keys', async () => {
    const { reader } = setup();

    await expect(reader.readSyntheticRows('')).rejects.toMatchObject({
      code: 'SYNTHETIC_DATASET_ARTIFACT_KEY_REQUIRED',
    });
  });

  it('throws SYNTHETIC_DATASET_ARTIFACT_NOT_FOUND when S3 misses', async () => {
    const { reader, s3ClientMock } = setup();
    const notFound = new Error('Not found');
    notFound.name = 'NoSuchKey';
    s3ClientMock.on(GetObjectCommand).rejects(notFound);

    await expect(
      reader.readSyntheticRows('datasets/missing/missing-synthetic.jsonl'),
    ).rejects.toMatchObject({
      code: 'SYNTHETIC_DATASET_ARTIFACT_NOT_FOUND',
    });
  });

  it('rejects invalid synthetic rows', async () => {
    const { reader, s3ClientMock } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () =>
          JSON.stringify({
            document_id: 'demo-dataset',
            chunk_id: 'demo-dataset-0',
            text: 'Chunk text',
            summary: 'Generated summary',
            status: 'queued',
          }),
      } as never,
    });

    await expect(
      reader.readSyntheticRows(
        'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      ),
    ).rejects.toMatchObject({
      code: 'INVALID_SYNTHETIC_DATASET_ARTIFACT_FORMAT',
    });
  });
});

function setup() {
  reset();
  registerTestInfrastructure();
  process.env.DATASET_BUCKET = 'test-bucket';

  return {
    reader: new SyntheticDatasetReaderS3(),
    s3ClientMock: mockClient(inject(tokenClientS3)),
  };
}

function syntheticArtifact(): string {
  return JSON.stringify({
    document_id: 'demo-dataset',
    chunk_id: 'demo-dataset-0',
    text: 'Chunk text',
    summary: 'Generated summary',
    status: 'completed',
  });
}
