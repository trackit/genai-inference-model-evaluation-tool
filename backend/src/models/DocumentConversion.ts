export enum ChunkingStrategy {
  DOCUMENT = 'DOCUMENT',
  CHAPTER = 'CHAPTER',
}

export type DocumentId = string;

export interface DocumentConversionRequest {
  datasetId: string;
  documents: DocumentId[];
  chunkingStrategy: ChunkingStrategy;
}

export type DocumentChunk = {
  documentId: DocumentId;
  chunkId: string;
  text: string;
};

export interface DocumentConversionResult {
  uncompleteDatasetFile: string;
  S3key: string;
  jsonl: string;
}

export interface ExtractedDocument {
  documentId: DocumentId;
  text: string;
}
