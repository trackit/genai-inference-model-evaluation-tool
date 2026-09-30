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
      custom_delimiter: undefined,
    });
    expect(output).toEqual({
      datasetId: 'ds1',
      taskType: 'summarization',
      convertedDatasetArtifactKey: 'datasets/ds1/ds1-converted.jsonl',
    });
  });

  it('passes custom delimiter with CUSTOM strategy', async () => {
    const { handler } = await import('./DocumentConversion');
    execute.mockResolvedValue('datasets/ds1/ds1-converted.jsonl');

    await handler({
      datasetId: 'ds1',
      taskType: 'summarization',
      chunkingStrategy: ChunkingStrategy.CUSTOM,
      customDelimiter: '##',
    });

    expect(execute).toHaveBeenCalledWith({
      dataset_id: 'ds1',
      chunking_strategy: ChunkingStrategy.CUSTOM,
      custom_delimiter: '##',
    });
  });

  it('rejects empty custom delimiter', async () => {
    const { handler } = await import('./DocumentConversion');

    await expect(
      handler({
        datasetId: 'ds1',
        taskType: 'summarization',
        chunkingStrategy: ChunkingStrategy.CUSTOM,
        customDelimiter: '',
      }),
    ).rejects.toThrow();
  });

  it('rejects custom delimiter over 50 characters', async () => {
    const { handler } = await import('./DocumentConversion');

    await expect(
      handler({
        datasetId: 'ds1',
        taskType: 'summarization',
        chunkingStrategy: ChunkingStrategy.CUSTOM,
        customDelimiter: 'a'.repeat(51),
      }),
    ).rejects.toThrow();
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
