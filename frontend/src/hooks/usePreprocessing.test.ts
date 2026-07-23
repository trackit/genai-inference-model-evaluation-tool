import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '@/services/apiService';
import { usePreprocessing } from './usePreprocessing';

describe('usePreprocessing', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('reaches succeeded when the execution succeeds', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      status: 'SUCCEEDED',
      structuredDatasetArtifactKey: 'datasets/ds1/ds1.jsonl',
      sampleCount: 2,
    });

    const { result } = renderHook(() => usePreprocessing());

    await act(async () => {
      await result.current.start('ds1', {
        taskType: 'summarization',
        chunkingStrategy: 'CHAPTER',
      });
    });

    await waitFor(() => expect(result.current.status).toBe('succeeded'));
  });

  it('reaches failed when the execution fails', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      status: 'FAILED',
    });

    const { result } = renderHook(() => usePreprocessing());

    await act(async () => {
      await result.current.start('ds1', {
        taskType: 'classification',
        chunkingStrategy: 'DOCUMENT',
      });
    });

    await waitFor(() => expect(result.current.status).toBe('failed'));
  });
});
