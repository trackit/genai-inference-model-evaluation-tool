import { cn } from '@/lib/utils';
import {
  PREPROCESSING_STAGES,
  type PreprocessingStage,
} from '@/types/evaluation';
import { Check, Loader2 } from 'lucide-react';

interface PreprocessingStagesProps {
  stage: PreprocessingStage | null;
  processedCount?: number | null;
  totalCount?: number | null;
}

const STATE_LABELS = {
  done: 'Completed',
  current: 'In progress',
  pending: 'Pending',
} as const;

export function PreprocessingStages({
  stage,
  processedCount,
  totalCount,
}: PreprocessingStagesProps) {
  const currentIndex = PREPROCESSING_STAGES.findIndex(
    (entry) => entry.stage === stage,
  );

  return (
    <div className="flex flex-col items-center py-20">
      <p className="mb-8 text-sm text-muted-foreground">
        Preprocessing the dataset…
      </p>
      <div role="status" className="w-full max-w-sm">
        <ul className="space-y-1">
          {PREPROCESSING_STAGES.map((entry, index) => {
            const state =
              currentIndex === -1
                ? 'pending'
                : index < currentIndex
                  ? 'done'
                  : index === currentIndex
                    ? 'current'
                    : 'pending';

            return (
              <li
                key={entry.stage}
                aria-current={state === 'current' ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-3 transition-colors',
                  state === 'current' && 'bg-primary/5',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                    state === 'done'
                      ? 'bg-accent text-accent-foreground'
                      : state === 'current'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {state === 'done' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : state === 'current' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    state === 'pending'
                      ? 'text-muted-foreground'
                      : 'text-foreground',
                  )}
                >
                  {entry.label}
                  {state === 'current' &&
                    typeof processedCount === 'number' &&
                    typeof totalCount === 'number' && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {processedCount} of {totalCount}
                      </span>
                    )}
                </span>
                <span className="sr-only">{STATE_LABELS[state]}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
