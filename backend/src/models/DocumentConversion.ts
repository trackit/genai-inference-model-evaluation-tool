import { DatasetFileType } from './Dataset';

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

export interface DocumentConversionResult {
  uncompleteDatasetFile: string;
  S3key: string;
}

export interface FetchedDocument {
  documentId: DocumentId;
  datasetId: string;
  fileType: DatasetFileType;
  rawContent: Buffer;
}

export interface ExtractedDocument {
  documentId: DocumentId;
  text: string;
}
