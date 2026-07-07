export const PREPROCESSING_TASK_TYPES = [
  'summarization',
  'classification',
] as const;

export type PreprocessingTaskType = (typeof PREPROCESSING_TASK_TYPES)[number];

export const CHUNKING_STRATEGIES = ['document', 'chapter'] as const;

export type ChunkingStrategy = (typeof CHUNKING_STRATEGIES)[number];

export interface StartPreprocessingRequest {
  documentIds: string[];
  taskType: PreprocessingTaskType;
  chunkingStrategy: ChunkingStrategy;
}

export interface ChunkDocumentsInput {
  documentIds: string[];
  chunkingStrategy: ChunkingStrategy;
}

export interface ChunkDocumentsOutput {
  convertedDatasetArtifactKey: string;
}

export interface ConvertedDatasetRow {
  chunk_id: string;
  document_id: string;
  text: string;
  summary?: string;
  class?: string;
}

export interface GenerateSyntheticOutputsInput {
  datasetId: string;
  convertedDatasetArtifactKey: string;
  taskType: PreprocessingTaskType;
  modelId?: string;
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

export interface GenerateSyntheticOutputsOutput {
  syntheticDatasetArtifactKey: string;
  generatedCount: number;
  failedCount: number;
}

export interface GenerateSyntheticOutputsResult {
  rows: SyntheticOutputRow[];
  generatedCount: number;
  failedCount: number;
}

export interface StructuredDatasetGenerationInput {
  syntheticDatasetArtifactKey: string;
}

export interface StructuredDatasetGenerationOutput {
  datasetId: string;
  structuredDatasetArtifactKey: string;
  sampleCount: number;
}
