export interface DatasetSample {
  prompt: string;
  context?: string;
  reference_output?: string;
}

export interface Dataset {
  samples: DatasetSample[];
}

export interface DatasetMetadata {
  dataset_id: string;
  sample_count: number;
  has_reference_outputs: boolean;
  has_context: boolean;
  s3_key: string;
}

export interface DatasetUploadResponse {
  success: boolean;
  data?: {
    dataset_id: string;
    sample_count: number;
    has_reference_outputs: boolean;
    has_context: boolean;
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
