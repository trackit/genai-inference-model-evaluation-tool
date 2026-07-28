import { register, reset } from '@trackit.io/di-container';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChunkingStrategy } from '../../models/DocumentConversion';
import { tokenDocumentConversionUseCase } from '../../useCases/DocumentConversion/DocumentConversionUseCase';

describe('DocumentConversion task handler', () => {
  const execute = vi.fn();

  beforeEach(() => {
    reset();
    vi.clearAllMocks();
    register(tokenDocumentConversionUseCase, { useValue: { execute } });
  });

  it('converts the dataset and returns the converted artifact key', async () => {
    const { handler } = await import('./DocumentConversion');
    execute.mockResolvedValue('datasets/ds1/ds1-converted.jsonl');

    const output = await handler({
      datasetId: 'ds1',
      taskType: 'summarization',
      chunkingStrategy: ChunkingStrategy.SECTION,
    });

    expect(execute).toHaveBeenCalledWith({
      dataset_id: 'ds1',
      chunking_strategy: ChunkingStrategy.SECTION,
    });
    expect(output).toEqual({
      datasetId: 'ds1',
      taskType: 'summarization',
      convertedDatasetArtifactKey: 'datasets/ds1/ds1-converted.jsonl',
    });
  });

  it('propagates errors so Step Functions can fail the execution', async () => {
    const { handler } = await import('./DocumentConversion');
    execute.mockRejectedValue(new Error('manifest not found'));

    await expect(
      handler({
        datasetId: 'ds1',
        taskType: 'summarization',
        chunkingStrategy: ChunkingStrategy.SECTION,
      }),
    ).rejects.toThrow('manifest not found');
  });
});
