export enum ChunkingStrategy {
  DOCUMENT = 'DOCUMENT',
  CHAPTER = 'CHAPTER',
}

export enum TaskType {
  CLASSIFICATION = 'Classification',
  SUMMARIZATION = 'Summarization',
}

export type DocumentId = string;

export interface DocumentConversionRequest {
  datasetId: string;
  documents: DocumentId[];
  chunkingStrategy: ChunkingStrategy;
  taskType: TaskType;
}

export type DocumentChunk = {
  documentId: DocumentId;
  chunkId: string;
  text: string;
};

export interface DocumentConversionResult {
  S3key: string;
}

export interface ExtractedDocument {
  documentId: DocumentId;
  text: string;
}
