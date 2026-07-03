export interface DatasetSample {
  document: string;
  summary?: string;
  class_label?: string;
}

export interface Dataset {
  samples: DatasetSample[];
}

export interface DatasetMetadata {
  dataset_id: string;
  sample_count: number;
  has_summary: boolean;
  has_class: boolean;
}

export type DatasetFileType = 'csv' | 'jsonl' | 'pdf' | 'doc' | 'docx';

export type StructuredDatasetMetadata = DatasetMetadata & {
  dataset_type: 'structured';
};

export type DocumentDatasetMetadata = {
  dataset_type: 'documents';
  dataset_id: string;
  file_count: number;
  documents: Array<{
    filename: string;
    file_type: DatasetFileType;
  }>;
};

export type DatasetConfirmMetadata =
  | StructuredDatasetMetadata
  | DocumentDatasetMetadata;

export type DocumentUploadManifestEntry = {
  document_id: string;
  filename: string;
  file_type: DatasetFileType;
  s3_key: string;
  size_bytes: number;
};

export type DocumentUploadManifest = {
  max_total_bytes: number;
  files: DocumentUploadManifestEntry[];
};

export const MIN_FILE_BYTES = 10;
export const MAX_DATASET_BYTES = 209_715_200;
