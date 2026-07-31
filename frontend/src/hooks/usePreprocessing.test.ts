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
        chunkingStrategy: 'SECTION',
      });
    });

    await waitFor(() => expect(result.current.status).toBe('succeeded'));
  });

  it('clears the stage when the execution reports none', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      status: 'SUCCEEDED',
      sampleCount: 1,
    });

    const { result } = renderHook(() => usePreprocessing());

    await act(async () => {
      await result.current.start('ds1', {
        taskType: 'summarization',
        chunkingStrategy: 'SECTION',
      });
    });

    await waitFor(() => expect(result.current.status).toBe('succeeded'));
    expect(result.current.stage).toBeNull();
  });

  it('exposes the stage while the execution is still running', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      status: 'RUNNING',
      stage: 'DOCUMENT_PARSING',
    });

    const { result, unmount } = renderHook(() => usePreprocessing());

    await act(async () => {
      await result.current.start('ds1', {
        taskType: 'summarization',
        chunkingStrategy: 'SECTION',
      });
    });

    expect(result.current.status).toBe('running');
    expect(result.current.stage).toBe('DOCUMENT_PARSING');

    unmount();
  });

  it('retains the failing stage when the execution fails', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      status: 'FAILED',
      stage: 'DOCUMENT_PARSING',
    });

    const { result } = renderHook(() => usePreprocessing());

    await act(async () => {
      await result.current.start('ds1', {
        taskType: 'classification',
        chunkingStrategy: 'DOCUMENT',
      });
    });

    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.stage).toBe('DOCUMENT_PARSING');
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
