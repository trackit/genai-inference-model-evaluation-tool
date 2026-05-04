import { DatasetUpload } from '@/components/evaluator/DatasetUpload';
import { MetricsWeights } from '@/components/evaluator/MetricsWeights';
import { ModelSelection } from '@/components/evaluator/ModelSelection';
import { ProgressView } from '@/components/evaluator/ProgressView';
import { ResultsView } from '@/components/evaluator/ResultsView';
import { StepIndicator } from '@/components/evaluator/StepIndicator';
import { Button } from '@/components/ui/button';
import {
  useCreateEvaluation,
  useEvaluationResults,
  useEvaluationStatus,
} from '@/hooks/useEvaluation';
import type { EvaluationConfig } from '@/types/evaluation';
import { AlertCircle, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Phase = 'config' | 'progress' | 'results';

export default function Index() {
  const [phase, setPhase] = useState<Phase>('config');
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<EvaluationConfig>({
    weights: { accuracy: 40, cost: 30, latency: 30 },
    selectedModels: [],
    datasetFile: null,
  });
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createEvaluationMutation = useCreateEvaluation();

  const statusQuery = useEvaluationStatus(evaluationId);

  const resultsQuery = useEvaluationResults(
    statusQuery.data?.status === 'completed' ? evaluationId : null,
  );

  useEffect(() => {
    if (statusQuery.data?.status === 'completed') {
      setPhase('results');
    }
  }, [statusQuery.data?.status]);

  const weightsSum =
    config.weights.accuracy + config.weights.cost + config.weights.latency;
  const weightsValid = weightsSum === 100;

  const completedSteps = [];
  if (weightsValid) completedSteps.push(0);
  if (config.selectedModels.length >= 3) completedSteps.push(1);
  if (config.datasetFile) completedSteps.push(2);

  const canNext =
    (step === 0 && weightsValid) ||
    (step === 1 && config.selectedModels.length >= 3);

  const handleStartEvaluation = useCallback(() => {
    if (!datasetId) return;
    const sum =
      config.weights.accuracy + config.weights.cost + config.weights.latency;
    if (sum !== 100) return;

    setError(null);
    createEvaluationMutation.mutate(
      {
        dataset_id: datasetId,
        models: config.selectedModels.map((id) => ({
          type: 'custom' as const,
          identifier: id,
        })),
        weights: {
          accuracy: config.weights.accuracy / 100,
          latency: config.weights.latency / 100,
          cost: config.weights.cost / 100,
        },
      },
      {
        onSuccess: (data) => {
          setEvaluationId(data.evaluation_id);
          setPhase('progress');
          setError(null);
        },
        onError: (err) => {
          setError(err.message);
        },
      },
    );
  }, [
    datasetId,
    config.selectedModels,
    config.weights,
    createEvaluationMutation,
  ]);

  const handleUploadSuccess = useCallback(
    (data: { dataset_id: string; sample_count: number }) => {
      setDatasetId(data.dataset_id);
    },
    [],
  );

  const handleReset = () => {
    setPhase('config');
    setStep(0);
    setConfig({
      weights: { accuracy: 40, cost: 30, latency: 30 },
      selectedModels: [],
      datasetFile: null,
    });
    setDatasetId(null);
    setEvaluationId(null);
    setError(null);
  };

  const statusData = statusQuery.data;
  const isFailedOrTimeout =
    statusData?.status === 'failed' || statusData?.status === 'timeout';

  return (
    <div className="flex min-h-screen">
      {phase === 'config' && (
        <StepIndicator currentStep={step} completedSteps={completedSteps} />
      )}
      <main className="flex-1 overflow-y-auto">
        <div
          className={`mx-auto px-6 py-10 ${phase === 'results' ? 'max-w-6xl' : 'max-w-2xl px-8'}`}
        >
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              AI Inference Evaluator
            </p>
          </div>

          {phase === 'config' && (
            <>
              {step === 0 && (
                <MetricsWeights
                  value={config.weights}
                  onChange={(w) => setConfig({ ...config, weights: w })}
                />
              )}
              {step === 1 && (
                <ModelSelection
                  selected={config.selectedModels}
                  onChange={(m) => setConfig({ ...config, selectedModels: m })}
                />
              )}
              {step === 2 && (
                <DatasetUpload
                  file={config.datasetFile}
                  onChange={(f) => setConfig({ ...config, datasetFile: f })}
                  onStartEvaluation={handleStartEvaluation}
                  onUploadSuccess={handleUploadSuccess}
                  isStarting={createEvaluationMutation.isPending}
                />
              )}

              {error && step === 2 && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between mt-10">
                {' '}
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  disabled={step === 0}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                {step < 2 && (
                  <Button
                    onClick={() => setStep(step + 1)}
                    disabled={!canNext}
                    className="gap-2"
                  >
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          )}

          {phase === 'progress' && statusData && (
            <>
              <ProgressView
                status={statusData.status}
                progress={statusData.progress}
                samplesProcessed={statusData.samples_processed}
                totalSamples={statusData.total_samples}
                currentModel={statusData.current_model}
                errorMessage={statusData.error_message}
              />
              {isFailedOrTimeout && (
                <div className="flex justify-center mt-6">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    New Evaluation
                  </Button>
                </div>
              )}
            </>
          )}

          {phase === 'progress' && !statusData && statusQuery.isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground mt-4">
                Loading evaluation status…
              </p>
            </div>
          )}

          {phase === 'results' && resultsQuery.data && (
            <ResultsView data={resultsQuery.data} onReset={handleReset} />
          )}

          {phase === 'results' && resultsQuery.isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground mt-4">
                Loading results…
              </p>
            </div>
          )}

          {phase === 'results' && resultsQuery.isError && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">{resultsQuery.error.message}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => resultsQuery.refetch()}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
