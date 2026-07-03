import { BasicError, BasicErrorType } from '../errors';
import {
  Dataset,
  DatasetFileType,
  MAX_DATASET_BYTES,
  MIN_FILE_BYTES,
  StructuredDatasetMetadata,
} from '../models/Dataset';

export function parseFileType(filename: string): DatasetFileType {
  const extension = filename.toLowerCase().split('.').pop();

  if (extension === 'csv') return 'csv';
  if (extension === 'jsonl') return 'jsonl';
  if (extension === 'pdf') return 'pdf';
  if (extension === 'doc') return 'doc';
  if (extension === 'docx') return 'docx';

  throw new BasicError(
    BasicErrorType.UNPROCESSABLE_ENTITY,
    'INVALID_FILE_FORMAT',
    'Invalid file format. Supported: CSV, JSONL, PDF, DOC, DOCX',
  );
}

export function isDatasetFile(type: DatasetFileType): type is 'csv' | 'jsonl' {
  return type === 'csv' || type === 'jsonl';
}

export function isDocumentFile(
  type: DatasetFileType,
): type is 'pdf' | 'doc' | 'docx' {
  return type === 'pdf' || type === 'doc' || type === 'docx';
}

export function fileContentType(fileType: DatasetFileType): string {
  switch (fileType) {
    case 'csv':
      return 'text/csv';
    case 'jsonl':
      return 'application/jsonl';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default: {
      const _exhaustive: never = fileType;
      throw new Error(`Unsupported file type: ${_exhaustive}`);
    }
  }
}

export function validateDeclaredTotalSize(sizeBytes: number[]): void {
  const total = sizeBytes.reduce((sum, size) => sum + size, 0);
  if (total > MAX_DATASET_BYTES) {
    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'DATASET_SIZE_EXCEEDED',
      `Total upload size must not exceed ${MAX_DATASET_BYTES} bytes`,
      `Declared total: ${total} bytes`,
    );
  }
}

export function validateUploadedFileSize(
  actualBytes: number,
  declaredMaxBytes: number,
): void {
  if (actualBytes < MIN_FILE_BYTES) {
    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'UPLOAD_INCOMPLETE',
      'One or more files were not uploaded or are empty',
    );
  }

  if (actualBytes > declaredMaxBytes) {
    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'FILE_SIZE_EXCEEDED',
      `Uploaded file exceeds declared size of ${declaredMaxBytes} bytes`,
      `Actual size: ${actualBytes} bytes`,
    );
  }
}

export function validateDatasetSize(dataset: Dataset): void {
  if (dataset.samples.length < 10) {
    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'INSUFFICIENT_SAMPLES',
      `Dataset must contain at least 10 samples. Found ${dataset.samples.length} samples`,
    );
  }
}

export function extractDatasetMetadata(
  datasetId: string,
  dataset: Dataset,
): StructuredDatasetMetadata {
  return {
    dataset_type: 'structured',
    dataset_id: datasetId,
    sample_count: dataset.samples.length,
    has_summary: dataset.samples.some((s) => s.summary !== undefined),
    has_class: dataset.samples.some((s) => s.class_label !== undefined),
  };
}
