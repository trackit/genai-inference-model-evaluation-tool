import { BasicError, BasicErrorType } from '../errors';
import { Dataset, DatasetMetadata } from '../models/Dataset';

export function parseDatasetFileExtension(filename: string): 'csv' | 'jsonl' {
  const extension = filename.toLowerCase().split('.').pop();

  if (extension === 'csv') {
    return 'csv';
  }
  if (extension === 'jsonl') {
    return 'jsonl';
  }

  throw new BasicError(
    BasicErrorType.UNPROCESSABLE_ENTITY,
    'INVALID_FILE_FORMAT',
    'Invalid file format. Only CSV and JSONL files are supported',
  );
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

export function scanForMaliciousContent(content: string): void {
  const maliciousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /eval\(/gi,
    /expression\(/gi,
  ];

  for (const pattern of maliciousPatterns) {
    if (pattern.test(content)) {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'MALICIOUS_CONTENT',
        'File contains potentially malicious content',
      );
    }
  }
}

export function extractDatasetMetadata(
  datasetId: string,
  dataset: Dataset,
): DatasetMetadata {
  return {
    dataset_id: datasetId,
    sample_count: dataset.samples.length,
    has_summary: dataset.samples.some((s) => s.summary !== undefined),
    has_class: dataset.samples.some((s) => s.class_label !== undefined),
  };
}
