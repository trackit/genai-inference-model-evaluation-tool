// TODO: remove this contract once chunk service will be ready

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
  chunkArtifactKey: string;
}

export interface DocumentChunkMetadata {
  section_title?: string;
  page_start?: number;
  page_end?: number;
}

export interface DocumentChunk {
  chunk_id: string;
  document_id: string;
  source_filename: string;
  chunk_index: number;
  text: string;
  metadata?: DocumentChunkMetadata;
}

export interface GenerateSyntheticOutputsInput {
  chunkArtifactKey: string;
  taskType: PreprocessingTaskType;
}

export interface SyntheticOutputRow {
  chunk_id: string;
  task_type: PreprocessingTaskType;
  output: string;
  status: 'completed' | 'failed';
  error_message?: string;
  model_id?: string;
}

export interface GenerateSyntheticOutputsOutput {
  syntheticOutputArtifactKey: string;
  generatedCount: number;
  failedCount: number;
}

export interface StructuredDatasetGenerationInput {
  chunkArtifactKey: string;
  syntheticOutputArtifactKey: string;
}

export interface StructuredDatasetGenerationOutput {
  datasetId: string;
  structuredDatasetArtifactKey: string;
  sampleCount: number;
}
