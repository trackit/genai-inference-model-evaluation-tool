export interface MetricsWeights {
  accuracy: number;
  cost: number;
  latency: number;
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

export type MetricsToggles = Record<MetricKey, boolean>;

export const DEFAULT_METRICS_TOGGLES: MetricsToggles = Object.fromEntries(
  METRIC_KEYS.map((k) => [k, false]),
) as MetricsToggles;

export type TaskType = 'summarization' | 'classification';

export interface ToggleableMetric {
  key: MetricKey;
  label: string;
  description: string;
  task?: TaskType;
  taskBadge?: string;
}

export interface MetricGroup {
  id: string;
  title: string;
  subtitle: string;
  metrics: ToggleableMetric[];
}

export const METRIC_GROUPS: MetricGroup[] = [
  {
    id: 'programmatic',
    title: 'Programmatic metrics',
    subtitle:
      'Deterministic scoring computed locally. Fast and cheap — only BERTScore has a noticeable load cost.',
    metrics: [
      {
        key: 'bleu',
        label: 'BLEU',
        description: 'N-gram overlap with the reference.',
        task: 'summarization',
        taskBadge: 'Summarization',
      },
      {
        key: 'rouge',
        label: 'ROUGE',
        description: 'Recall-oriented n-gram overlap.',
        task: 'summarization',
        taskBadge: 'Summarization',
      },
      {
        key: 'meteor',
        label: 'METEOR',
        description: 'Stem-aware overlap, more lenient than BLEU.',
        task: 'summarization',
        taskBadge: 'Summarization',
      },
      {
        key: 'levenshtein',
        label: 'Levenshtein similarity',
        description: 'Character-level edit-distance similarity.',
        task: 'summarization',
        taskBadge: 'Summarization',
      },
      {
        key: 'bertscore',
        label: 'BERTScore',
        description:
          'Embedding-based semantic similarity. Loads a transformer model once per run.',
        task: 'summarization',
        taskBadge: 'Summarization',
      },
      {
        key: 'classification_accuracy',
        label: 'Accuracy',
        description: 'Fraction of predictions that match the reference label.',
        task: 'classification',
        taskBadge: 'Classification',
      },
      {
        key: 'precision_macro',
        label: 'Precision (macro)',
        description: 'Per-class precision averaged across labels.',
        task: 'classification',
        taskBadge: 'Classification',
      },
      {
        key: 'recall_macro',
        label: 'Recall (macro)',
        description: 'Per-class recall averaged across labels.',
        task: 'classification',
        taskBadge: 'Classification',
      },
      {
        key: 'f1_macro',
        label: 'F1 (macro)',
        description: 'Harmonic mean of precision and recall, unweighted.',
        task: 'classification',
        taskBadge: 'Classification',
      },
      {
        key: 'f1_weighted',
        label: 'F1 (weighted)',
        description: 'F1 weighted by class support.',
        task: 'classification',
        taskBadge: 'Classification',
      },
    ],
  },
  {
    id: 'llm-judge',
    title: 'LLM-as-judge metrics',
    subtitle:
      'Quality scores produced by an extra Bedrock model per sample. Most accurate, but the slowest and most expensive metrics.',
    metrics: [
      {
        key: 'geval_reasoning',
        label: 'G-Eval — Reasoning',
        description: 'How coherent and well-justified the output is.',
      },
      {
        key: 'geval_faithfulness',
        label: 'G-Eval — Faithfulness',
        description:
          'Whether the output sticks to the input (no hallucination).',
      },
    ],
  },
];

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  contextWindow: string;
  costPer1kTokens: number;
}

export interface EvaluationConfig {
  weights: MetricsWeights;
  metrics: MetricsToggles;
  selectedModels: string[];
  datasetFiles: File[];
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
    id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
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
  metrics?: Partial<Record<MetricKey, boolean>>;
}

export interface StructuredDatasetUploadData {
  dataset_type: 'structured';
  dataset_id: string;
  sample_count: number;
  has_summary: boolean;
  has_class: boolean;
}

export interface DocumentDatasetUploadData {
  dataset_type: 'documents';
  dataset_id: string;
  file_count: number;
  documents: Array<{
    filename: string;
    file_type: string;
  }>;
}

export type DatasetUploadData =
  | StructuredDatasetUploadData
  | DocumentDatasetUploadData;

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
