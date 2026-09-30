import { Button } from '@/components/ui/button';
import { usePreprocessing } from '@/hooks/usePreprocessing';
import {
  PREPROCESSING_STAGES,
  type PreprocessingChunkingStrategy,
  type PreprocessingStage,
  type PreprocessingTaskType,
} from '@/types/evaluation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';

import { PreprocessingStages } from './PreprocessingStages';

interface PreprocessingStepProps {
  datasetId: string;
  taskType: PreprocessingTaskType;
  chunkingStrategy: PreprocessingChunkingStrategy;
  customDelimiter?: string;
  onDone: (sampleCount: number | null) => void;
  onBack: () => void;
}

function failureMessage(stage: PreprocessingStage | null): string {
  const label = PREPROCESSING_STAGES.find(
    (entry) => entry.stage === stage,
  )?.label;

  return label ? `${label} failed.` : 'Preprocessing failed.';
}

export function PreprocessingStep({
  datasetId,
  taskType,
  chunkingStrategy,
  customDelimiter,
  onDone,
  onBack,
}: PreprocessingStepProps) {
  const { status, sampleCount, stage, start } = usePreprocessing();

  useEffect(() => {
    void start(datasetId, { taskType, chunkingStrategy, customDelimiter });
  }, [datasetId, taskType, chunkingStrategy, customDelimiter, start]);

  useEffect(() => {
    if (status === 'succeeded') onDone(sampleCount);
  }, [status, sampleCount, onDone]);

  if (status === 'failed') {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Preprocessing failed
        </h1>
        <div
          className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{failureMessage(stage)}</span>
        </div>
        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button
            onClick={() =>
              void start(datasetId, {
                taskType,
                chunkingStrategy,
                customDelimiter,
              })
            }
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return <PreprocessingStages stage={stage} />;
}
