import { register, reset } from '@trackit.io/di-container';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';
import { tokenGenerateStructuredDatasetUseCase } from '../../useCases/GenerateStructuredDataset/GenerateStructuredDatasetUseCase';

describe('CombineAndStructureTask Handler', () => {
  const readSyntheticRows = vi.fn();
  const writeSyntheticDataset = vi.fn();
  const generateStructuredDataset = vi.fn();

  beforeEach(() => {
    reset();
    vi.clearAllMocks();
    register(tokenDatasetService, {
      useValue: { readSyntheticRows, writeSyntheticDataset },
    });
    register(tokenGenerateStructuredDatasetUseCase, {
      useValue: { generateStructuredDataset },
    });
  });

  it('assembles the synthetic dataset then builds the structured dataset', async () => {
    const { handler } = await import('./CombineAndStructureTask');
    const rows = [
      {
        chunk_id: 'c1',
        document_id: 'd1',
        text: 't',
        summary: 's',
        status: 'completed',
      },
    ];
    readSyntheticRows.mockResolvedValue(rows);
    writeSyntheticDataset.mockResolvedValue({
      syntheticDatasetArtifactKey: 'datasets/ds1/ds1-synthetic.jsonl',
    });
    generateStructuredDataset.mockResolvedValue({
      datasetId: 'ds1',
      structuredDatasetArtifactKey: 'datasets/ds1/ds1.jsonl',
      sampleCount: 1,
    });

    const result = await handler({ datasetId: 'ds1' });

    expect(writeSyntheticDataset).toHaveBeenCalledWith('ds1', rows);
    expect(generateStructuredDataset).toHaveBeenCalledWith({
      datasetId: 'ds1',
      syntheticDatasetArtifactKey: 'datasets/ds1/ds1-synthetic.jsonl',
    });
    expect(result).toEqual({
      datasetId: 'ds1',
      structuredDatasetArtifactKey: 'datasets/ds1/ds1.jsonl',
      sampleCount: 1,
    });
  });
});
