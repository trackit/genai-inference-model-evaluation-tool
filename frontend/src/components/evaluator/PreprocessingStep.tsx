import { Button } from '@/components/ui/button';
import { usePreprocessing } from '@/hooks/usePreprocessing';
import {
  PREPROCESSING_STAGES,
  type PreprocessingChunkingStrategy,
  type PreprocessingStage,
  type PreprocessingTaskType,
} from '@/types/evaluation';
import { useEffect } from 'react';

import { PreprocessingStages } from './PreprocessingStages';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

interface PreprocessingDoneResult {
  sampleCount: number | null;
  failedCount: number | null;
}

interface PreprocessingStepProps {
  datasetId: string;
  taskType: PreprocessingTaskType;
  chunkingStrategy: PreprocessingChunkingStrategy;
  onDone: (result: PreprocessingDoneResult) => void;
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
  onDone,
  onBack,
}: PreprocessingStepProps) {
  const { status, stage, sampleCount, failedCount, processedCount, totalCount, start } = usePreprocessing();

  useEffect(() => {
    void start(datasetId, { taskType, chunkingStrategy });
  }, [datasetId, taskType, chunkingStrategy, start]);

  useEffect(() => {
    if (status === 'succeeded' && !failedCount) {
      onDone({ sampleCount, failedCount });
    }
  }, [status, sampleCount, failedCount, onDone]);

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
              void start(datasetId, { taskType, chunkingStrategy })
            }
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'succeeded' && failedCount) {
    const total = (sampleCount ?? 0) + failedCount;
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Preprocessing complete
        </h1>
        <div
          className="mt-4 flex items-start gap-3 rounded-lg bg-warning/10 p-4 text-sm text-warning"
          role="status"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <strong>{sampleCount ?? 0}</strong> of <strong>{total}</strong>{' '}
            rows generated successfully. <strong>{failedCount}</strong>{' '}
            {failedCount === 1 ? 'row' : 'rows'} failed and{' '}
            {failedCount === 1 ? 'was' : 'were'} excluded from the dataset.
            You can still continue with the {sampleCount ?? 0} successful{' '}
            {sampleCount === 1 ? 'sample' : 'samples'}.
          </span>
        </div>
        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button
            onClick={() => onDone({ sampleCount, failedCount })}
            className="gap-2"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PreprocessingStages
      stage={stage}
      processedCount={processedCount}
      totalCount={totalCount}
    />
  );
}
