import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getPreprocessingStatus,
  startPreprocessing,
} from '@/services/apiService';
import type {
  PreprocessingChunkingStrategy,
  PreprocessingStage,
  PreprocessingTaskType,
} from '@/types/evaluation';

type Phase = 'idle' | 'running' | 'succeeded' | 'failed';

const POLL_INITIAL_DELAY_MS = 2000;
const POLL_BACKOFF_RATE = 1.5;
const POLL_MAX_DELAY_MS = 15000;

const MAX_CONSECUTIVE_POLL_FAILURES = 5;

export function usePreprocessing() {
  const [status, setStatus] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sampleCount, setSampleCount] = useState<number | null>(null);
  const [stage, setStage] = useState<PreprocessingStage | null>(null);
  const [failedCount, setFailedCount] = useState<number | null>(null);
  const [processedCount, setProcessedCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runId = useRef(0);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(
    () => () => {
      runId.current += 1;
      clear();
    },
    [clear],
  );

  const start = useCallback(
    async (
      datasetId: string,
      params: {
        taskType: PreprocessingTaskType;
        chunkingStrategy: PreprocessingChunkingStrategy;
      },
    ): Promise<void> => {
      clear();
      const thisRun = ++runId.current;
      const isStale = (): boolean => thisRun !== runId.current;

      setError(null);
      setSampleCount(null);
      setStage(null);
      setFailedCount(null);
      setProcessedCount(null);
      setTotalCount(null);
      setStatus('running');

      let delay = POLL_INITIAL_DELAY_MS;
      let consecutivePollFailures = 0;

      try {
        const { executionArn } = await startPreprocessing(datasetId, params);
        if (isStale()) return;

        const poll = async (): Promise<void> => {
          let result;
          try {
            result = await getPreprocessingStatus(datasetId, executionArn);
            consecutivePollFailures = 0;
          } catch {
            if (isStale()) return;
            consecutivePollFailures += 1;
            if (consecutivePollFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
              setStatus('failed');
              setError('Lost contact with the server while checking status');
              return;
            }

            timer.current = setTimeout(() => void poll(), delay);
            return;
          }
          if (isStale()) return;

          if (result.state === 'COMPLETED') {
            setSampleCount(result.sampleCount ?? null);
            setFailedCount(result.failedCount ?? null);
            setStatus('succeeded');
            return;
          }
          if (result.state === 'ERRORED') {
            setStatus('failed');
            setError('Preprocessing failed');
            return;
          }

          setStage(
            result.state === 'DOCUMENT_PARSING' ||
              result.state === 'GENERATING_SYNTHETIC_OUTPUTS'
              ? result.state
              : null,
          );
          setProcessedCount(result.processedCount ?? null);
          setTotalCount(result.totalCount ?? null);

          const currentDelay = delay;
          delay = Math.min(delay * POLL_BACKOFF_RATE, POLL_MAX_DELAY_MS);
          timer.current = setTimeout(() => void poll(), currentDelay);
        };

        await poll();
      } catch (e: unknown) {
        if (isStale()) return;
        setStatus('failed');
        setError(e instanceof Error ? e.message : 'Preprocessing failed');
      }
    },
    [clear],
  );

  return {
    status,
    stage,
    error,
    sampleCount,
    processedCount,
    totalCount,
    failedCount,
    start,
  };
}
