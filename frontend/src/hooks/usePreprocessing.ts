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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const start = useCallback(
    async (
      datasetId: string,
      params: {
        taskType: PreprocessingTaskType;
        chunkingStrategy: PreprocessingChunkingStrategy;
      },
    ): Promise<void> => {
      setError(null);
      setSampleCount(null);
      setStage(null);
      setStatus('running');
      try {
        const { executionArn } = await startPreprocessing(datasetId, params);

        const poll = async (): Promise<void> => {
          const result = await getPreprocessingStatus(datasetId, executionArn);
          setStage(result.stage ?? null);
          if (result.status === 'SUCCEEDED') {
            setSampleCount(result.sampleCount ?? null);
            setStatus('succeeded');
            return;
          }
          if (result.status === 'FAILED') {
            setStatus('failed');
            setError('Preprocessing failed');
            return;
          }
          timer.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        };

        await poll();
      } catch (e: unknown) {
        setStatus('failed');
        setError(e instanceof Error ? e.message : 'Preprocessing failed');
      }
    },
    [],
  );

  return { status, error, sampleCount, stage, start };
}
