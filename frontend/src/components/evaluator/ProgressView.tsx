import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ProgressViewProps {
  status: string;
  progress: number;
  samplesProcessed?: number;
  totalSamples?: number;
  currentModel?: string;
  errorMessage?: string;
}

export function ProgressView({
  status,
  progress,
  samplesProcessed,
  totalSamples,
  currentModel,
  errorMessage,
}: ProgressViewProps) {
  const pct = Math.round(progress);
  const isPending = status === 'pending';
  const [showCompiling, setShowCompiling] = useState(false);

  useEffect(() => {
    if (pct < 100) {
      return;
    }

    const timer = setTimeout(() => setShowCompiling(true), 1000);
    return () => {
      clearTimeout(timer);
      setShowCompiling(false);
    };
  }, [pct]);

  const isCompiling = pct >= 100 && showCompiling;

  const getHeading = () => {
    if (isPending) return 'Evaluation Queued';
    if (isCompiling) return 'Compiling Results';
    return 'Evaluating Models';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center py-20"
    >
      <h1 className="text-2xl font-semibold tracking-tight mb-2">
        {getHeading()}
      </h1>

      {isPending ? (
        <>
          <p className="text-sm text-muted-foreground mb-8">
            Your evaluation is starting soon…
          </p>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </>
      ) : isCompiling ? (
        <>
          <p className="text-sm text-muted-foreground mb-8">
            All samples processed. Preparing your results…
          </p>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-8">
            Processing{' '}
            <span className="font-mono font-semibold text-foreground">
              {samplesProcessed ?? 0}
            </span>
            {' / '}
            <span className="font-mono">{totalSamples ?? 0}</span> rows
          </p>
          <div className="w-full max-w-md">
            <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: 'circOut' }}
                className="bg-primary h-full rounded-full"
              />
            </div>
            <p className="text-right text-xs font-mono text-muted-foreground mt-2">
              {pct}%
            </p>
          </div>
          {currentModel && (
            <p className="text-sm text-muted-foreground mt-4">
              Currently evaluating: {currentModel}
            </p>
          )}
        </>
      )}

      {errorMessage && (
        <p className="text-sm text-destructive mt-4">{errorMessage}</p>
      )}
    </motion.div>
  );
}
