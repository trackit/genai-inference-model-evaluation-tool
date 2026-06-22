import {
  EvaluationJob,
  JobStatus,
  MetricsConfig,
  ModelConfig,
  WeightConfig,
} from '../models/Evaluation';

export interface EvaluationJobsRepository {
  createEvaluation(
    datasetId: string,
    models: ModelConfig[],
    weights: WeightConfig,
    metrics: MetricsConfig,
  ): Promise<EvaluationJob>;

  updateEvaluation(
    evaluationId: string,
    updates: {
      status?: JobStatus;
      progress?: number;
      current_model?: string;
      samples_processed?: number;
      total_samples?: number;
      error_message?: string;
    },
  ): Promise<void>;

  getEvaluation(evaluationId: string): Promise<EvaluationJob | null>;
}
