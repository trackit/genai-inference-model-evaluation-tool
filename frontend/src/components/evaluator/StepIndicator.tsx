import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const STEPS = [
  { label: 'Weights', description: 'Set metric priorities' },
  { label: 'Models', description: 'Choose candidates' },
  { label: 'Dataset', description: 'Upload & validate' },
  { label: 'Confirm', description: 'Preview & Launch' },
];

interface StepIndicatorProps {
  currentStep: number;
  completedSteps: number[];
}

export function StepIndicator({
  currentStep,
  completedSteps,
}: StepIndicatorProps) {
  return (
    <div className="w-64 shrink-0 border-r border-border p-6">
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-8">
        Configuration
      </h2>
      <nav className="space-y-1">
        {STEPS.map((step, i) => {
          const isCompleted = completedSteps.includes(i);
          const isCurrent = currentStep === i;
          return (
            <div
              key={step.label}
              className={cn(
                'flex items-start gap-3 rounded-lg px-3 py-3 transition-colors',
                isCurrent && 'bg-primary/5',
              )}
            >
              <div
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all',
                  isCompleted
                    ? 'bg-accent text-accent-foreground'
                    : isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <div>
                <p
                  className={cn(
                    'text-sm font-medium',
                    isCurrent ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
