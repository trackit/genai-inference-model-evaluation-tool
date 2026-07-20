import { inject, reset } from '@trackit.io/di-container';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConvertedDatasetRow } from '../../models/SyntheticOutput';
import {
  FakeDatasetService,
  tokenFakeDatasetService,
} from '../../services/DatasetService/FakeDatasetService';
import {
  FakeSyntheticOutputModelClient,
  tokenFakeSyntheticOutputModelClient,
} from '../../services/SyntheticOutputModelClient/FakeSyntheticOutputModelClient';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { RunSyntheticPreprocessingUseCaseImpl } from './RunSyntheticPreprocessingUseCase';

describe('RunSyntheticPreprocessingUseCase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates synthetic output and final structured dataset artifacts', async () => {
    const { fakeDatasetService, fakeModelClient, useCase } = setup();
    fakeDatasetService.seedConvertedDatasetRows(
      'datasets/demo-dataset/demo-dataset-converted.jsonl',
      convertedRows(),
    );
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
      structuredDatasetArtifactKey: 'datasets/demo-dataset/demo-dataset.jsonl',
      generatedCount: 2,
      failedCount: 0,
      sampleCount: 2,
    });
    expect(
      artifactBody(
        fakeDatasetService,
        'datasets/demo-dataset/demo-dataset.jsonl',
      ),
    ).toBe(
      '{"document":"First document chunk","summary":"Summary one"}\n' +
        '{"document":"Second document chunk","summary":"Summary two"}\n',
    );
  });

  it('retries failed rows and proceeds to structured dataset on recovery', async () => {
    const { fakeDatasetService, fakeModelClient, useCase } = setup();
    fakeDatasetService.seedConvertedDatasetRows(
      'datasets/demo-dataset/demo-dataset-converted.jsonl',
      convertedRows(),
    );
    fakeModelClient.queueOutput('Summary one');
    fakeModelClient.queueError(new Error('transient'));
    fakeModelClient.queueOutput('Summary two recovered');

    const promise = useCase.runSyntheticPreprocessing({
      datasetId: 'demo-dataset',
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      taskType: 'summarization',
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toMatchObject({
      generatedCount: 2,
      failedCount: 0,
      sampleCount: 2,
    });
    expect(
      artifactBody(
        fakeDatasetService,
        'datasets/demo-dataset/demo-dataset.jsonl',
      ),
    ).toContain('Summary two recovered');
  });

  it('throws after exhausting retries when rows remain failed', async () => {
    const { fakeDatasetService, fakeModelClient, useCase } = setup();
    fakeDatasetService.seedConvertedDatasetRows(
      'datasets/demo-dataset/demo-dataset-converted.jsonl',
      convertedRows(),
    );
    fakeModelClient.queueOutput('Summary one');
    fakeModelClient.queueError(new Error('fail 1'));
    fakeModelClient.queueError(new Error('fail 2'));
    fakeModelClient.queueError(new Error('fail 3'));

    const promise = useCase
      .runSyntheticPreprocessing({
        datasetId: 'demo-dataset',
        convertedDatasetArtifactKey:
          'datasets/demo-dataset/demo-dataset-converted.jsonl',
        taskType: 'summarization',
      })
      .catch((e: unknown) => e);
    await vi.runAllTimersAsync();

    const error = await promise;
    expect(error).toMatchObject({
      code: 'SYNTHETIC_GENERATION_FAILED',
    });

    expect(
      fakeDatasetService.artifacts.some(
        (a) => a.key === 'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      ),
    ).toBe(true);
    expect(
      fakeDatasetService.artifacts.some(
        (a) => a.key === 'datasets/demo-dataset/demo-dataset.jsonl',
      ),
    ).toBe(false);
  });
});

function setup() {
  reset();
  registerTestInfrastructure();

  return {
    fakeDatasetService: inject(tokenFakeDatasetService),
    fakeModelClient: inject(
      tokenFakeSyntheticOutputModelClient,
    ) as FakeSyntheticOutputModelClient,
    useCase: new RunSyntheticPreprocessingUseCaseImpl(),
  };
}

function artifactBody(
  fakeDatasetService: FakeDatasetService,
  key: string,
): string | undefined {
  return fakeDatasetService.artifacts.find((a) => a.key === key)?.body;
}

function convertedRows(): ConvertedDatasetRow[] {
  return [
    {
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-0',
      document: 'First document chunk',
    },
    {
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-1',
      document: 'Second document chunk',
    },
  ];
}
