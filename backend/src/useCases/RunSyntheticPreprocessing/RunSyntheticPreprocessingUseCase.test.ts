import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';

import {
  FakeDatasetService,
  tokenFakeDatasetService,
} from '../../services/DatasetService/FakeDatasetService';
import { tokenFakeSyntheticOutputModelClient } from '../../services/SyntheticOutputModelClient/FakeSyntheticOutputModelClient';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { RunSyntheticPreprocessingUseCaseImpl } from './RunSyntheticPreprocessingUseCase';

describe('RunSyntheticPreprocessingUseCase', () => {
  it('generates synthetic output and final structured dataset artifacts', async () => {
    const { fakeDatasetService, fakeModelClient, useCase } = setup();
    seedConvertedArtifact(fakeDatasetService);
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
    expect(fakeDatasetService.artifacts).toHaveLength(3);
    expect(
      artifactBody(fakeDatasetService, 'datasets/demo-dataset.jsonl'),
    ).toBe(
      '{"document":"First document chunk","summary":"Summary one"}\n' +
        '{"document":"Second document chunk","summary":"Summary two"}\n',
    );
  });

  it('does not write the final structured dataset when generation has failures', async () => {
    const { fakeDatasetService, fakeModelClient, useCase } = setup();
    seedConvertedArtifact(fakeDatasetService);
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

    expect(
      fakeDatasetService.artifacts.some(
        (a) => a.key === 'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      ),
    ).toBe(true);
    expect(
      fakeDatasetService.artifacts.some(
        (a) => a.key === 'datasets/demo-dataset.jsonl',
      ),
    ).toBe(false);
  });
});

function setup() {
  reset();
  registerTestInfrastructure();

  return {
    fakeDatasetService: inject(tokenFakeDatasetService),
    fakeModelClient: inject(tokenFakeSyntheticOutputModelClient),
    useCase: new RunSyntheticPreprocessingUseCaseImpl(),
  };
}

function seedConvertedArtifact(fakeDatasetService: FakeDatasetService): void {
  fakeDatasetService.artifacts.push({
    key: 'datasets/demo-dataset/demo-dataset-converted.jsonl',
    body: convertedArtifact(),
    contentType: 'application/jsonl',
  });
}

function artifactBody(
  fakeDatasetService: FakeDatasetService,
  key: string,
): string | undefined {
  return fakeDatasetService.artifacts.find((a) => a.key === key)?.body;
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
