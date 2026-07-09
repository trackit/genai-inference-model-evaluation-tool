export const PREPROCESSING_TASK_TYPES = [
  'summarization',
  'classification',
] as const;

export type PreprocessingTaskType = (typeof PREPROCESSING_TASK_TYPES)[number];

export const CHUNKING_STRATEGIES = ['document', 'chapter'] as const;

export type ChunkingStrategy = (typeof CHUNKING_STRATEGIES)[number];

export interface ConvertedDatasetRow {
  chunk_id: string;
  document_id: string;
  text: string;
  summary?: string;
  class?: string;
}

export interface SyntheticOutputRow {
  chunk_id: string;
  document_id: string;
  text: string;
  summary?: string;
  class?: string;
  status: 'completed' | 'failed';
  error_message?: string;
  model_id?: string;
}
