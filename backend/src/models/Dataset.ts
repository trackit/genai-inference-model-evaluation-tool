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
  s3_key: string;
}

export interface DatasetUploadResponse {
  success: boolean;
  data?: {
    dataset_id: string;
    sample_count: number;
    has_summary: boolean;
    has_class: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: {
      row?: number;
      line?: number;
      issue?: string;
    };
  };
}
