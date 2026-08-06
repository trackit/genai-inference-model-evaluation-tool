import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '@/services/apiService';
import { usePreprocessing } from './usePreprocessing';

describe('usePreprocessing', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('reaches succeeded when the execution completes', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      state: 'COMPLETED',
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
    expect(result.current.sampleCount).toBe(2);
  });

  it('leaves the stage null when the run completes without one', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      state: 'COMPLETED',
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
      state: 'DOCUMENT_PARSING',
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

  it('has no stage while the run is only STARTING', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      state: 'STARTING',
    });

    const { result, unmount } = renderHook(() => usePreprocessing());

    await act(async () => {
      await result.current.start('ds1', {
        taskType: 'summarization',
        chunkingStrategy: 'SECTION',
      });
    });

    expect(result.current.status).toBe('running');
    expect(result.current.stage).toBeNull();

    unmount();
  });

  it('retains the last in-progress stage when the execution fails', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
        executionArn: 'arn:1',
        status: 'RUNNING',
      });
      vi.spyOn(api, 'getPreprocessingStatus')
        .mockResolvedValueOnce({ state: 'DOCUMENT_PARSING' })
        .mockResolvedValue({ state: 'ERRORED' });

      const { result } = renderHook(() => usePreprocessing());

      await act(async () => {
        await result.current.start('ds1', {
          taskType: 'classification',
          chunkingStrategy: 'DOCUMENT',
        });
      });

      expect(result.current.stage).toBe('DOCUMENT_PARSING');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(result.current.status).toBe('failed');
      expect(result.current.stage).toBe('DOCUMENT_PARSING');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reaches failed when the execution errors', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      state: 'ERRORED',
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

  it('does not poll the superseded execution after a re-run', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(api, 'startPreprocessing')
        .mockResolvedValueOnce({ executionArn: 'arn:1', status: 'RUNNING' })
        .mockResolvedValueOnce({ executionArn: 'arn:2', status: 'RUNNING' });
      const getStatus = vi
        .spyOn(api, 'getPreprocessingStatus')
        .mockResolvedValue({ state: 'DOCUMENT_PARSING' });

      const { result } = renderHook(() => usePreprocessing());
      const params = {
        taskType: 'summarization' as const,
        chunkingStrategy: 'SECTION' as const,
      };

      await act(async () => {
        await result.current.start('ds1', params);
      });
      await act(async () => {
        await result.current.start('ds1', params);
      });

      getStatus.mockClear();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      const polledArns = getStatus.mock.calls.map(([, arn]) => arn);
      expect(polledArns).not.toContain('arn:1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores an in-flight status result from a superseded execution', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(api, 'startPreprocessing')
        .mockResolvedValueOnce({ executionArn: 'arn:1', status: 'RUNNING' })
        .mockResolvedValueOnce({ executionArn: 'arn:2', status: 'RUNNING' });

      let releaseFirstPoll: (() => void) | undefined;
      const firstPollBlocked = new Promise<void>((resolve) => {
        releaseFirstPoll = resolve;
      });

      vi.spyOn(api, 'getPreprocessingStatus').mockImplementation(
        async (_datasetId: string, executionArn: string) => {
          if (executionArn === 'arn:1') {
            await firstPollBlocked;
            return { state: 'ERRORED' as const };
          }
          return { state: 'GENERATING_SYNTHETIC_OUTPUTS' as const };
        },
      );

      const { result } = renderHook(() => usePreprocessing());
      const params = {
        taskType: 'summarization' as const,
        chunkingStrategy: 'SECTION' as const,
      };

      // First run stalls mid-request, so no timer is pending to clear.
      let firstRun: Promise<void> | undefined;
      await act(async () => {
        firstRun = result.current.start('ds1', params);
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.start('ds1', params);
      });

      await act(async () => {
        releaseFirstPoll?.();
        await firstRun;
      });

      expect(result.current.status).toBe('running');
      expect(result.current.stage).toBe('GENERATING_SYNTHETIC_OUTPUTS');
    } finally {
      vi.useRealTimers();
    }
  });
});
