import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';

import { tokenClientS3 } from '../../services/DatasetService/DatasetServiceS3';
import { tokenFakeSyntheticOutputModelClient } from '../../services/SyntheticOutputModelClient/FakeSyntheticOutputModelClient';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { RunSyntheticPreprocessingUseCaseImpl } from './RunSyntheticPreprocessingUseCase';

describe('RunSyntheticPreprocessingUseCase', () => {
  it('generates synthetic output and final structured dataset artifacts', async () => {
    const { fakeModelClient, s3ClientMock, useCase } = setup();
    s3ClientMock.on(GetObjectCommand).callsFake(async (input) => {
      if (input.Key === 'datasets/demo-dataset/demo-dataset-converted.jsonl') {
        return {
          Body: {
            transformToString: async () => convertedArtifact(),
          },
        };
      }
      if (input.Key === 'datasets/demo-dataset/demo-dataset-synthetic.jsonl') {
        const syntheticBody = s3ClientMock.commandCalls(PutObjectCommand)[0]
          .args[0].input.Body as string;
        return {
          Body: {
            transformToString: async () => syntheticBody,
          },
        };
      }
      throw new Error(`Unexpected key: ${input.Key}`);
    });
    s3ClientMock.on(PutObjectCommand).resolves({});
    fakeModelClient.queueOutput('Summary one');
    fakeModelClient.queueOutput('Summary two');

    const result = await useCase.runSyntheticPreprocessing({
      datasetId: 'demo-dataset',
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      taskType: 'summarization',
      modelId: 'test-model',
    });

    expect(result).toEqual({
      datasetId: 'demo-dataset',
      syntheticDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      structuredDatasetArtifactKey: 'datasets/demo-dataset.jsonl',
      generatedCount: 2,
      failedCount: 0,
      sampleCount: 2,
    });
    expect(s3ClientMock.commandCalls(PutObjectCommand)).toHaveLength(2);
    expect(
      s3ClientMock.commandCalls(PutObjectCommand)[1].args[0].input,
    ).toEqual(
      expect.objectContaining({
        Key: 'datasets/demo-dataset.jsonl',
        Body:
          '{"document":"First document chunk","summary":"Summary one"}\n' +
          '{"document":"Second document chunk","summary":"Summary two"}\n',
      }),
    );
  });

  it('does not write the final structured dataset when generation has failures', async () => {
    const { fakeModelClient, s3ClientMock, useCase } = setup();
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: {
        transformToString: async () => convertedArtifact(),
      } as never,
    });
    s3ClientMock.on(PutObjectCommand).resolves({});
    fakeModelClient.queueOutput('Summary one');
    fakeModelClient.queueError(new Error('model failed'));

    await expect(
      useCase.runSyntheticPreprocessing({
        datasetId: 'demo-dataset',
        convertedDatasetArtifactKey:
          'datasets/demo-dataset/demo-dataset-converted.jsonl',
        taskType: 'summarization',
      }),
    ).rejects.toMatchObject({
      code: 'SYNTHETIC_GENERATION_FAILED',
    });

    expect(s3ClientMock.commandCalls(PutObjectCommand)).toHaveLength(1);
    expect(
      s3ClientMock.commandCalls(PutObjectCommand)[0].args[0].input,
    ).toEqual(
      expect.objectContaining({
        Key: 'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      }),
    );
  });
});

function setup() {
  reset();
  registerTestInfrastructure();
  process.env.DATASET_BUCKET = 'test-bucket';

  return {
    fakeModelClient: inject(tokenFakeSyntheticOutputModelClient),
    s3ClientMock: mockClient(inject(tokenClientS3)),
    useCase: new RunSyntheticPreprocessingUseCaseImpl(),
  };
}

function convertedArtifact(): string {
  return [
    JSON.stringify({
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-0',
      text: 'First document chunk',
      summary: '',
    }),
    JSON.stringify({
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-1',
      text: 'Second document chunk',
      summary: '',
    }),
  ].join('\n');
}
