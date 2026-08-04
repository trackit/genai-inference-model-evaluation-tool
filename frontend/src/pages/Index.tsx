import { AccessCodeGate } from '@/components/auth/AccessCodeGate';
import { DatasetConfirm } from '@/components/evaluator/DatasetConfirm';
import { DatasetUpload } from '@/components/evaluator/DatasetUpload';
import { MetricsPicker } from '@/components/evaluator/MetricsPicker';
import { MetricsWeights } from '@/components/evaluator/MetricsWeights';
import { ModelSelection } from '@/components/evaluator/ModelSelection';
import { PreprocessingStep } from '@/components/evaluator/PreprocessingStep';
import { ProgressView } from '@/components/evaluator/ProgressView';
import { ResultsView } from '@/components/evaluator/ResultsView';
import { StepIndicator } from '@/components/evaluator/StepIndicator';
import { Button } from '@/components/ui/button';
import { useAccessSession } from '@/hooks/useAccessSession';
import {
  useCreateEvaluation,
  useEvaluationResults,
  useEvaluationStatus,
} from '@/hooks/useEvaluation';
import type {
  EvaluationConfig,
  PreprocessingChunkingStrategy,
  TaskType,
} from '@/types/evaluation';
import { DEFAULT_METRICS_TOGGLES } from '@/types/evaluation';
import {
  buildDefaultsForTask,
  hasAtLeastOneMetric,
  pickEnabledMetrics,
} from '@/utils/metrics';
import { AlertCircle, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { useCallback, useState } from 'react';

type Phase = 'config' | 'progress' | 'results';

export default function Index() {
  const { state: accessState, signIn } = useAccessSession();
  const [phase, setPhase] = useState<Phase>('config');
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<EvaluationConfig>({
    weights: { accuracy: 40, cost: 30, latency: 30 },
    metrics: { ...DEFAULT_METRICS_TOGGLES },
    selectedModels: [],
    datasetFiles: [],
  });
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [datasetKind, setDatasetKind] = useState<
    'structured' | 'documents' | null
  >(null);
  const [preprocessingDone, setPreprocessingDone] = useState(false);
  const [chunkingStrategy, setChunkingStrategy] =
    useState<PreprocessingChunkingStrategy>('DOCUMENT');
  const [sampleCount, setSampleCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [detectedTaskType, setDetectedTaskType] = useState<
    TaskType | undefined
  >(undefined);
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createEvaluationMutation = useCreateEvaluation();

  const statusQuery = useEvaluationStatus(evaluationId);

  const resultsQuery = useEvaluationResults(
    statusQuery.data?.status === 'completed' ? evaluationId : null,
  );

  const activePhase: Phase =
    statusQuery.data?.status === 'completed' ? 'results' : phase;

  const weightsSum =
    config.weights.accuracy + config.weights.cost + config.weights.latency;
  const weightsValid = weightsSum === 100;

  const completedSteps = [];
  if (weightsValid) completedSteps.push(0);
  if (config.selectedModels.length >= 3) completedSteps.push(1);
  if (datasetId !== null) completedSteps.push(2);

  const canNext =
    (step === 0 && weightsValid) ||
    (step === 1 && config.selectedModels.length >= 3);

  const handleStartEvaluation = useCallback(() => {
    if (!datasetId) return;
    const sum =
      config.weights.accuracy + config.weights.cost + config.weights.latency;
    if (sum !== 100) return;

    if (!hasAtLeastOneMetric(config.metrics)) {
      setError('At least one accuracy metric must be selected.');
      return;
    }

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
        metrics: pickEnabledMetrics(config.metrics),
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
    config.metrics,
    createEvaluationMutation,
  ]);

  const handleUploadSuccess = useCallback(
    (data: {
      dataset_type: 'structured' | 'documents';
      dataset_id: string;
      taskType: TaskType | undefined;
      sample_count?: number;
    }) => {
      setDatasetId(data.dataset_id);
      setDatasetKind(data.dataset_type);
      setDetectedTaskType(data.taskType);
      setSampleCount(data.sample_count ?? 0);
      setFailedCount(0);
      setPreprocessingDone(data.dataset_type === 'structured');
      setConfig((prev) => ({
        ...prev,
        metrics: buildDefaultsForTask(data.taskType),
      }));
      setStep(3);
    },
    [],
  );

  const handleDocumentsConfirmed = useCallback(
    (data: {
      dataset_id: string;
      taskType: TaskType;
      chunkingStrategy: PreprocessingChunkingStrategy;
      file_count: number;
    }) => {
      setDatasetId(data.dataset_id);
      setDatasetKind('documents');
      setDetectedTaskType(data.taskType);
      setChunkingStrategy(data.chunkingStrategy);
      setSampleCount(data.file_count);
      setFailedCount(0);
      setPreprocessingDone(false);
      setConfig((prev) => ({
        ...prev,
        metrics: buildDefaultsForTask(data.taskType),
      }));
      setStep(3);
    },
    [],
  );

  const handlePreprocessingDone = useCallback(
    (result: { sampleCount: number | null; failedCount: number | null }) => {
      if (result.sampleCount !== null) setSampleCount(result.sampleCount);
      setFailedCount(result.failedCount ?? 0);
      setPreprocessingDone(true);
    },
    [],
  );

  const handleReset = () => {
    setPhase('config');
    setStep(0);
    setConfig({
      weights: { accuracy: 40, cost: 30, latency: 30 },
      metrics: { ...DEFAULT_METRICS_TOGGLES },
      selectedModels: [],
      datasetFiles: [],
    });
    setDatasetId(null);
    setDatasetKind(null);
    setPreprocessingDone(false);
    setChunkingStrategy('DOCUMENT');
    setSampleCount(0);
    setFailedCount(0);
    setDetectedTaskType(undefined);
    setEvaluationId(null);
    setError(null);
  };

  const statusData = statusQuery.data;
  const isFailedOrTimeout =
    statusData?.status === 'failed' || statusData?.status === 'timeout';

  if (accessState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (accessState === 'unauthenticated') {
    return <AccessCodeGate onAuthenticated={signIn} />;
  }

  return (
    <div className="flex min-h-screen">
      {activePhase === 'config' && (
        <StepIndicator currentStep={step} completedSteps={completedSteps} />
      )}
      <main className="flex-1 overflow-y-auto">
        <div
          className={`mx-auto px-6 py-10 ${activePhase === 'results' ? 'max-w-6xl' : 'max-w-2xl px-8'}`}
        >
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              AI Inference Evaluator
            </p>
          </div>

          {activePhase === 'config' && (
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
                  files={config.datasetFiles}
                  onChange={(files) =>
                    setConfig({ ...config, datasetFiles: files })
                  }
                  onUploadSuccess={handleUploadSuccess}
                  onDocumentsConfirmed={handleDocumentsConfirmed}
                />
              )}
              {step === 3 &&
                datasetId &&
                datasetKind === 'documents' &&
                !preprocessingDone && (
                  <PreprocessingStep
                    datasetId={datasetId}
                    taskType={detectedTaskType ?? 'summarization'}
                    chunkingStrategy={chunkingStrategy}
                    onDone={handlePreprocessingDone}
                    onBack={() => {
                      setDatasetId(null);
                      setDatasetKind(null);
                      setSampleCount(0);
                      setFailedCount(0);
                      setDetectedTaskType(undefined);
                      setConfig((prev) => ({ ...prev, datasetFiles: [] }));
                      setStep(2);
                    }}
                  />
                )}
              {step === 3 && datasetId && preprocessingDone && (
                <>
                  <MetricsPicker
                    metrics={config.metrics}
                    onChange={(m) => setConfig({ ...config, metrics: m })}
                    taskType={detectedTaskType}
                  />
                  {!hasAtLeastOneMetric(config.metrics) && (
                    <p className="mt-2 text-xs text-destructive" role="alert">
                      Select at least one accuracy metric to continue.
                    </p>
                  )}
                  <div className="mt-4">
                    <DatasetConfirm
                      datasetId={datasetId}
                      sampleCount={sampleCount}
                      failedCount={failedCount}
                      onConfirm={handleStartEvaluation}
                      onBack={() => {
                        setDatasetId(null);
                        setSampleCount(0);
                        setFailedCount(0);
                        setDetectedTaskType(undefined);
                        setConfig((prev) => ({ ...prev, datasetFiles: [] }));
                        setStep(2);
                      }}
                      isStarting={createEvaluationMutation.isPending}
                    />
                  </div>
                  {error && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </>
              )}

              {/* Navigation — only steps 0–2; step 3 has its own buttons inside DatasetConfirm */}
              {step < 3 && (
                <div className="flex justify-between mt-10">
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
              )}
            </>
          )}

          {activePhase === 'progress' && statusData && (
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

          {activePhase === 'progress' &&
            !statusData &&
            statusQuery.isLoading && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground mt-4">
                  Loading evaluation status…
                </p>
              </div>
            )}

          {activePhase === 'results' && resultsQuery.data && (
            <ResultsView data={resultsQuery.data} onReset={handleReset} />
          )}

          {activePhase === 'results' && resultsQuery.isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground mt-4">
                Loading results…
              </p>
            </div>
          )}

          {activePhase === 'results' && resultsQuery.isError && (
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
