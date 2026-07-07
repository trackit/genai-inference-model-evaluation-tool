import { PutObjectCommand } from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';

import { SyntheticOutputRow } from '../../models/Preprocessing';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';
import { SyntheticDatasetWriterS3 } from './SyntheticDatasetWriter';

describe('SyntheticDatasetWriterS3', () => {
  it('writes synthetic rows as JSONL to the dataset bucket', async () => {
    const { s3ClientMock, writer } = setup();
    s3ClientMock.on(PutObjectCommand).resolves({});

    const result = await writer.writeSyntheticDataset('demo-dataset', [
      summarizationRow('demo-dataset-0', 'Summary one'),
      summarizationRow('demo-dataset-1', 'Summary two'),
    ]);

    expect(result).toEqual({
      syntheticDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
    });
    expect(s3ClientMock.commandCalls(PutObjectCommand)).toHaveLength(1);
    expect(
      s3ClientMock.commandCalls(PutObjectCommand)[0].args[0].input,
    ).toEqual({
      Bucket: 'test-bucket',
      Key: 'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      Body:
        '{"document_id":"demo-dataset","chunk_id":"demo-dataset-0","text":"Chunk text","summary":"Summary one","status":"completed"}\n' +
        '{"document_id":"demo-dataset","chunk_id":"demo-dataset-1","text":"Chunk text","summary":"Summary two","status":"completed"}\n',
      ContentType: 'application/jsonl',
      ServerSideEncryption: 'AES256',
    });
  });

  it('writes an empty JSONL artifact when there are no rows', async () => {
    const { s3ClientMock, writer } = setup();
    s3ClientMock.on(PutObjectCommand).resolves({});

    await writer.writeSyntheticDataset('demo-dataset', []);

    expect(
      s3ClientMock.commandCalls(PutObjectCommand)[0].args[0].input,
    ).toEqual(
      expect.objectContaining({
        Body: '',
      }),
    );
  });

  it('rejects an empty dataset id', async () => {
    const { writer } = setup();

    await expect(writer.writeSyntheticDataset('   ', [])).rejects.toMatchObject(
      {
        code: 'DATASET_ID_REQUIRED',
      },
    );
  });
});

function setup() {
  reset();
  registerTestInfrastructure();
  process.env.DATASET_BUCKET = 'test-bucket';

  return {
    s3ClientMock: mockClient(inject(tokenClientS3)),
    writer: new SyntheticDatasetWriterS3(),
  };
}

function summarizationRow(
  chunkId: string,
  summary: string,
): SyntheticOutputRow {
  return {
    document_id: 'demo-dataset',
    chunk_id: chunkId,
    text: 'Chunk text',
    summary,
    status: 'completed',
  };
}
