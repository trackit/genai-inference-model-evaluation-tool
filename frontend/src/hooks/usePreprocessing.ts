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

const POLL_INTERVAL_MS = 3000;

export function usePreprocessing() {
  const [status, setStatus] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sampleCount, setSampleCount] = useState<number | null>(null);
  const [stage, setStage] = useState<PreprocessingStage | null>(null);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);
  const [failedCount, setFailedCount] = useState<number | null>(null);
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
      setGeneratedCount(null);
      setFailedCount(null);
      setStatus('running');

      try {
        const { executionArn } = await startPreprocessing(datasetId, params);
        if (isStale()) return;

        const poll = async (): Promise<void> => {
          const result = await getPreprocessingStatus(datasetId, executionArn);
          if (isStale()) return;

          if (result.state === 'COMPLETED') {
            setSampleCount(result.sampleCount ?? null);
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
          timer.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
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

  return { status, stage, error, sampleCount, generatedCount, failedCount, start };
}
