export interface ModelConfig {
  type: 'default' | 'custom';
  identifier: string;
}

export interface WeightConfig {
  accuracy: number;
  latency: number;
  cost: number;
}

/**
 * Canonical list of every metric the engine knows how to compute, in display
 * order, grouped by semantic category.
 *
 * This is the SINGLE SOURCE OF TRUTH for metric keys in the backend. Adding a
 * new metric is a one-line change here — the type alias, the default config
 * and the Zod payload schema are all derived from this list.
 *
 * Keep this list in sync with the frontend `METRIC_KEYS` (and the Python
 * `metrics.METRIC_KEYS`); a cross-language enum would be ideal, but absent
 * that, mirror the additions manually.
 */
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

/**
 * Per-metric opt-in flags.
 *
 * Latency and cost are always computed (they are free from inference data).
 *
 * - Algorithmic / programmatic metrics are deterministic and run locally.
 *   They are mostly fast; only BERTScore has a meaningful loading cost.
 * - LLM-as-judge metrics call an extra Bedrock model per sample — they are
 *   the main lever for both speed and spend.
 *
 * Metrics that are not applicable to the uploaded dataset (e.g. classification
 * metrics on a summarization run) are skipped automatically.
 */
export type MetricsConfig = Record<MetricKey, boolean>;

export const DEFAULT_METRICS_CONFIG: MetricsConfig = Object.fromEntries(
  METRIC_KEYS.map((k) => [k, true]),
) as MetricsConfig;

/**
 * Merge a partial user-provided config with the defaults (all enabled).
 * Unknown keys are ignored; missing keys fall back to the default value.
 */
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
