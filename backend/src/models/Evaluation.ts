export enum ModelMode {
  RUNTIME = 'runtime',
  MANTLE = 'mantle',
}

export interface ModelConfig {
  type: 'default' | 'custom';
  identifier: string;
  mode: ModelMode;
}

export interface WeightConfig {
  accuracy: number;
  latency: number;
  cost: number;
}

export const METRIC_KEYS = [
  // Algorithmic — summarization
  'bleu',
  'rouge',
  'meteor',
  'levenshtein',
  'bertscore',
  // Algorithmic — classification
  'classification_accuracy',
  'precision_macro',
  'recall_macro',
  'f1_macro',
  'f1_weighted',
  // LLM-as-judge
  'geval_reasoning',
  'geval_faithfulness',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export type MetricsConfig = Record<MetricKey, boolean>;

export const DEFAULT_METRICS_CONFIG: MetricsConfig = Object.fromEntries(
  METRIC_KEYS.map((k) => [k, false]),
) as MetricsConfig;

export function resolveMetricsConfig(
  metrics?: Partial<MetricsConfig>,
): MetricsConfig {
  const result = { ...DEFAULT_METRICS_CONFIG };
  if (!metrics) return result;
  for (const key of METRIC_KEYS) {
    const provided = metrics[key];
    if (provided !== undefined) result[key] = provided;
  }
  return result;
}

export interface EvaluationRequest {
  dataset_id: string;
  models: ModelConfig[];
  weights?: Partial<WeightConfig>;
  metrics?: Partial<MetricsConfig>;
}

export interface EvaluationJob {
  evaluation_id: string;
  dataset_id: string;
  models: ModelConfig[];
  weights: WeightConfig;
  metrics: MetricsConfig;
  status: JobStatus;
  progress: number;
  current_model?: string;
  samples_processed?: number;
  total_samples?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  model_results?: ModelResult[];
  recommendation?: Recommendation;
}

export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout';

export interface EvaluationLaunchResponse {
  success: boolean;
  data?: {
    evaluation_id: string;
    status: JobStatus;
    created_at: string;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface EvaluationStatusData {
  evaluation_id: string;
  status: JobStatus;
  progress: number;
  current_model?: string;
  samples_processed?: number;
  total_samples?: number;
  error_message?: string;
}

export interface EvaluationStatusResponse {
  success: boolean;
  data?: EvaluationStatusData;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface AccuracyMetrics {
  bleu?: number;
  rouge?: number;
  meteor?: number;
  levenshtein?: number;
  bertscore?: number;
  geval_reasoning?: number;
  geval_faithfulness?: number;
  classification_accuracy?: number;
  precision_macro?: number;
  recall_macro?: number;
  f1_macro?: number;
  f1_weighted?: number;
}

export interface LatencyMetrics {
  tokens_per_second: number;
  time_to_first_token_ms: number;
  total_latency_ms: number;
}

export interface CostMetrics {
  total_usd: number;
  input_tokens: number;
  output_tokens: number;
}

export interface ModelResult {
  identifier: string;
  metrics: {
    accuracy?: AccuracyMetrics;
    latency: LatencyMetrics;
    cost: CostMetrics;
  };
  weighted_score?: number;
  status: 'completed' | 'failed';
  error_count?: number;
}

export interface Recommendation {
  model_identifier: string;
  weighted_score: number;
  reasoning: string;
}

export interface EvaluationResultsData {
  evaluation_id: string;
  dataset_id: string;
  models: ModelResult[];
  recommendation: Recommendation;
  weights: WeightConfig;
  completed_at: string;
}
