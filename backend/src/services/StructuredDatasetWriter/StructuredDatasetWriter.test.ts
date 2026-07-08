import { PutObjectCommand } from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';

import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';
import { StructuredDatasetWriterS3 } from './StructuredDatasetWriter';

describe('StructuredDatasetWriterS3', () => {
  it('writes evaluator-ready JSONL to the existing dataset path', async () => {
    const { s3ClientMock, writer } = setup();
    s3ClientMock.on(PutObjectCommand).resolves({});

    const result = await writer.writeStructuredDataset('demo-dataset', [
      { document: 'Chunk text', summary: 'Generated summary' },
      { document: 'Other text', class_label: 'support_policy' },
    ]);

    expect(result).toEqual({
      structuredDatasetArtifactKey: 'datasets/demo-dataset.jsonl',
    });
    expect(
      s3ClientMock.commandCalls(PutObjectCommand)[0].args[0].input,
    ).toEqual({
      Bucket: 'test-bucket',
      Key: 'datasets/demo-dataset.jsonl',
      Body:
        '{"document":"Chunk text","summary":"Generated summary"}\n' +
        '{"document":"Other text","class":"support_policy"}\n',
      ContentType: 'application/jsonl',
      ServerSideEncryption: 'AES256',
    });
  });

  it('rejects an empty dataset id', async () => {
    const { writer } = setup();

    await expect(writer.writeStructuredDataset('', [])).rejects.toMatchObject({
      code: 'DATASET_ID_REQUIRED',
    });
  });
});

function setup() {
  reset();
  registerTestInfrastructure();
  process.env.DATASET_BUCKET = 'test-bucket';

  return {
    s3ClientMock: mockClient(inject(tokenClientS3)),
    writer: new StructuredDatasetWriterS3(),
  };
}
