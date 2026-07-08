import { DatasetFileType } from "./Dataset";

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

export function isSupportedDocumentFileType(
  fileType: DatasetFileType,
): fileType is SupportedDocumentFileType {
  return (SUPPORTED_DOCUMENT_FILE_TYPES as readonly string[]).includes(fileType);
}

export interface DocumentConversionRequest {
  dataset_id: string;
  documents: DocumentRequestEntry[];
  chunking_strategy: ChunkingStrategy;
  task_type: TaskType;
}

export type DocumentChunk = {
  document_id: string;
  chunk_id: string;
  text: string;
};

export interface DocumentConversionResult {
  converted_dataset_file_key: string;
}

export interface ExtractedDocument {
  document_id: string;
  text: string;
}
