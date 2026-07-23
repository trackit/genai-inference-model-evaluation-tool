import { register, reset } from '@trackit.io/di-container';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';
import { tokenGenerateSyntheticOutputsUseCase } from '../../useCases/GenerateSyntheticOutputs/GenerateSyntheticOutputsUseCase';

describe('GenerateSyntheticRowTask Handler', () => {
  const generateSyntheticRow = vi.fn();
  const writeSyntheticRow = vi.fn();

  beforeEach(() => {
    reset();
    vi.clearAllMocks();
    register(tokenGenerateSyntheticOutputsUseCase, {
      useValue: { generateSyntheticRow },
    });
    register(tokenDatasetService, { useValue: { writeSyntheticRow } });
  });

  it('generates a row, persists it, and returns the pointer', async () => {
    const { handler } = await import('./GenerateSyntheticRowTask');
    const generated = {
      chunk_id: 'c1',
      document_id: 'd1',
      text: 'text',
      summary: 's',
      status: 'completed',
    };
    generateSyntheticRow.mockResolvedValue(generated);

    const result = await handler({
      datasetId: 'ds1',
      taskType: 'summarization',
      row: { chunk_id: 'c1', document_id: 'd1', document: 'text' },
    });

    expect(writeSyntheticRow).toHaveBeenCalledWith('ds1', 'c1', generated);
    expect(result).toEqual({ chunk_id: 'c1', status: 'completed' });
  });

  it('throws (for Step Functions retry) when generation fails', async () => {
    const { handler } = await import('./GenerateSyntheticRowTask');
    generateSyntheticRow.mockRejectedValue(new Error('throttled'));

    await expect(
      handler({
        datasetId: 'ds1',
        taskType: 'summarization',
        row: { chunk_id: 'c1', document_id: 'd1', document: 'text' },
      }),
    ).rejects.toThrow('throttled');
    expect(writeSyntheticRow).not.toHaveBeenCalled();
  });
});
