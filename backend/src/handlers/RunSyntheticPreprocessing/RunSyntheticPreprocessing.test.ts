import { register, reset } from '@trackit.io/di-container';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenRunSyntheticPreprocessingUseCase } from '../../useCases/RunSyntheticPreprocessing/RunSyntheticPreprocessingUseCase';

describe('RunSyntheticPreprocessing task handler', () => {
  const runSyntheticPreprocessing = vi.fn();

  beforeEach(() => {
    reset();
    vi.clearAllMocks();
    register(tokenRunSyntheticPreprocessingUseCase, {
      useValue: { runSyntheticPreprocessing },
    });
  });

  it('runs synthetic preprocessing and returns the use case result', async () => {
    const { handler } = await import('./RunSyntheticPreprocessing');
    const result = {
      datasetId: 'demo-dataset',
      syntheticDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-synthetic.jsonl',
      structuredDatasetArtifactKey: 'datasets/demo-dataset/demo-dataset.jsonl',
      generatedCount: 2,
      failedCount: 0,
      sampleCount: 2,
    };
    runSyntheticPreprocessing.mockResolvedValue(result);

    const output = await handler({
      datasetId: 'demo-dataset',
      taskType: 'summarization',
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      modelId: 'test-model',
    });

    expect(output).toEqual(result);
    expect(runSyntheticPreprocessing).toHaveBeenCalledWith({
      datasetId: 'demo-dataset',
      convertedDatasetArtifactKey:
        'datasets/demo-dataset/demo-dataset-converted.jsonl',
      taskType: 'summarization',
      modelId: 'test-model',
    });
  });

  it('propagates use case errors so Step Functions can fail/retry', async () => {
    const { handler } = await import('./RunSyntheticPreprocessing');
    runSyntheticPreprocessing.mockRejectedValue(new Error('generation failed'));

    await expect(
      handler({
        datasetId: 'demo-dataset',
        taskType: 'classification',
        convertedDatasetArtifactKey:
          'datasets/demo-dataset/demo-dataset-converted.jsonl',
      }),
    ).rejects.toThrow('generation failed');
  });
});
