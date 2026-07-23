import { Button } from '@/components/ui/button';
import { usePreprocessing } from '@/hooks/usePreprocessing';
import type {
  PreprocessingChunkingStrategy,
  PreprocessingTaskType,
} from '@/types/evaluation';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect } from 'react';

interface PreprocessingStepProps {
  datasetId: string;
  taskType: PreprocessingTaskType;
  chunkingStrategy: PreprocessingChunkingStrategy;
  onDone: (sampleCount: number | null) => void;
  onBack: () => void;
}

export function PreprocessingStep({
  datasetId,
  taskType,
  chunkingStrategy,
  onDone,
  onBack,
}: PreprocessingStepProps) {
  const { status, error, sampleCount, start } = usePreprocessing();

  useEffect(() => {
    void start(datasetId, { taskType, chunkingStrategy });
  }, [datasetId, taskType, chunkingStrategy, start]);

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
          <span>{error ?? 'Preprocessing failed.'}</span>
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

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm" role="status">
        Preprocessing the dataset…
      </p>
    </div>
  );
}
