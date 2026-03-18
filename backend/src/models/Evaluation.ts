export interface ModelConfig {
  type: 'default' | 'custom';
  identifier: string;
}

export interface WeightConfig {
  accuracy: number;
  latency: number;
  cost: number;
}

export interface EvaluationRequest {
  dataset_id: string;
  models: ModelConfig[];
  weights?: Partial<WeightConfig>;
}

export interface EvaluationJob {
  evaluation_id: string;
  dataset_id: string;
  models: ModelConfig[];
  weights: WeightConfig;
  status: JobStatus;
  progress: number;
  created_at: string;
  updated_at: string;
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
