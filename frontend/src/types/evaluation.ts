export interface MetricsWeights {
  accuracy: number;
  cost: number;
  latency: number;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  contextWindow: string;
  costPer1kTokens: number;
}

export interface EvaluationConfig {
  weights: MetricsWeights;
  selectedModels: string[];
  datasetFile: File | null;
}

export interface ModelResult {
  modelId: string;
  name: string;
  provider: string;
  accuracy: number;
  latency: number;
  costPer1kTokens: number;
  weightedScore: number;
}

export interface EvaluationResult {
  recommended: ModelResult;
  reason: string;
  allResults: ModelResult[];
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'amazon-nova',
    name: 'Amazon Nova Pro',
    provider: 'Amazon',
    contextWindow: '300K',
    costPer1kTokens: 0.0008,
  },
  {
    id: 'amazon-nova-lite',
    name: 'Amazon Nova Lite',
    provider: 'Amazon',
    contextWindow: '300K',
    costPer1kTokens: 0.00006,
  },
  {
    id: 'amazon-nova-micro',
    name: 'Amazon Nova Micro',
    provider: 'Amazon',
    contextWindow: '128K',
    costPer1kTokens: 0.000035,
  },
];

export interface CreateEvaluationRequest {
  dataset_id: string;
  models: { type: 'default'; identifier: string }[];
  weights: { accuracy: number; latency: number; cost: number };
}

export interface DatasetUploadData {
  dataset_id: string;
  sample_count: number;
  has_summary: boolean;
  has_class: boolean;
}

export interface EvaluationLaunchData {
  evaluation_id: string;
  status: JobStatus;
  created_at: string;
}

export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout';

export interface EvaluationStatusData {
  evaluation_id: string;
  status: JobStatus;
  progress: number;
  current_model?: string;
  samples_processed?: number;
  total_samples?: number;
  error_message?: string;
}

export interface EvaluationResultsData {
  evaluation_id: string;
  dataset_id: string;
  models: ModelEvaluationResult[];
  recommendation: {
    model_identifier: string;
    weighted_score: number;
    reasoning: string;
  };
  weights: { accuracy: number; latency: number; cost: number };
  completed_at: string;
}

export interface ModelEvaluationResult {
  identifier: string;
  metrics: {
    accuracy?: {
      bleu?: number;
      rouge?: number;
      meteor?: number;
      bertscore?: number;
      geval_reasoning?: number;
      geval_faithfulness?: number;
    };
    latency: {
      tokens_per_second: number;
      time_to_first_token_ms: number;
      total_latency_ms: number;
    };
    cost: {
      total_usd: number;
      input_tokens: number;
      output_tokens: number;
    };
  };
  status: 'completed' | 'failed';
  error_count?: number;
}
