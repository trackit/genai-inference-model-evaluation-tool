import { DatasetFileType } from './Dataset';

export enum ChunkingStrategy {
  DOCUMENT = 'DOCUMENT',
  CHAPTER = 'CHAPTER',
}

export enum TaskType {
  CLASSIFICATION = 'Classification',
  SUMMARIZATION = 'Summarization',
}

export type DocumentRequestEntry = {
  document_id: string;
  file_type: DatasetFileType;
};

export const SUPPORTED_DOCUMENT_FILE_TYPES = ['pdf', 'doc', 'docx'] as const;
export type SupportedDocumentFileType =
  (typeof SUPPORTED_DOCUMENT_FILE_TYPES)[number];

export type DocumentChunk = {
  document_id: string;
  chunk_id: string;
  text: string;
};

export interface ExtractedDocument {
  document_id: string;
  text: string;
}
