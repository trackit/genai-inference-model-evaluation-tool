import { Button } from '@/components/ui/button';
import { usePreprocessing } from '@/hooks/usePreprocessing';
import type {
  PreprocessingChunkingStrategy,
  PreprocessingTaskType,
} from '@/types/evaluation';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PreprocessingStepProps {
  datasetId: string;
  onDone: (taskType: PreprocessingTaskType) => void;
  onBack: () => void;
}

const TASK_TYPES: { value: PreprocessingTaskType; label: string }[] = [
  { value: 'summarization', label: 'Summarization' },
  { value: 'classification', label: 'Classification' },
];

const CHUNKING_STRATEGIES: {
  value: PreprocessingChunkingStrategy;
  label: string;
  hint: string;
}[] = [
  { value: 'CHAPTER', label: 'By chapter', hint: 'One sample per chapter' },
  { value: 'DOCUMENT', label: 'Whole document', hint: 'One sample per file' },
];

export function PreprocessingStep({
  datasetId,
  onDone,
  onBack,
}: PreprocessingStepProps) {
  const { status, error, start } = usePreprocessing();
  const [taskType, setTaskType] =
    useState<PreprocessingTaskType>('summarization');
  const [chunkingStrategy, setChunkingStrategy] =
    useState<PreprocessingChunkingStrategy>('CHAPTER');

  useEffect(() => {
    if (status === 'succeeded') onDone(taskType);
  }, [status, taskType, onDone]);

  if (status === 'running' || status === 'succeeded') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm" role="status">
          Preprocessing the dataset…
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Prepare your documents
      </h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Choose how to turn your documents into an evaluation dataset. This runs
        parsing, chunking, and synthetic output generation.
      </p>

      <div className="space-y-6">
        <fieldset>
          <legend className="text-sm font-medium mb-2">Task type</legend>
          <div className="flex gap-2">
            {TASK_TYPES.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={taskType === option.value ? 'default' : 'outline'}
                onClick={() => setTaskType(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium mb-2">
            Chunking strategy
          </legend>
          <div className="flex gap-2">
            {CHUNKING_STRATEGIES.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={
                  chunkingStrategy === option.value ? 'default' : 'outline'
                }
                onClick={() => setChunkingStrategy(option.value)}
                title={option.hint}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </fieldset>
      </div>

      {status === 'failed' && (
        <div
          className="mt-6 flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error ?? 'Preprocessing failed.'}</span>
        </div>
      )}

      <div className="flex justify-between mt-10">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={() => void start(datasetId, { taskType, chunkingStrategy })}>
          {status === 'failed' ? 'Retry' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
