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
  // Amazon Nova
  {
    id: 'us.amazon.nova-pro-v1:0',
    name: 'Nova Pro',
    provider: 'Amazon',
    contextWindow: '300K',
    costPer1kTokens: 0.0008,
  },
  {
    id: 'us.amazon.nova-lite-v1:0',
    name: 'Nova Lite',
    provider: 'Amazon',
    contextWindow: '300K',
    costPer1kTokens: 0.00006,
  },
  {
    id: 'us.amazon.nova-micro-v1:0',
    name: 'Nova Micro',
    provider: 'Amazon',
    contextWindow: '128K',
    costPer1kTokens: 0.000035,
  },
  // Anthropic
  {
    id: 'us.anthropic.claude-opus-4-6-v1',
    name: 'Claude Opus 4.6',
    provider: 'Anthropic',
    contextWindow: '200K',
    costPer1kTokens: 0.005,
  },
  {
    id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    contextWindow: '200K',
    costPer1kTokens: 0.003,
  },
  {
    id: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    contextWindow: '200K',
    costPer1kTokens: 0.0008,
  },
];

export interface CreateEvaluationRequest {
  dataset_id: string;
  models: { type: 'default' | 'custom'; identifier: string }[];
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
      levenshtein?: number;
      bertscore?: number;
      geval_reasoning?: number;
      geval_faithfulness?: number;
      classification_accuracy?: number;
      precision_macro?: number;
      recall_macro?: number;
      f1_macro?: number;
      f1_weighted?: number;
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
