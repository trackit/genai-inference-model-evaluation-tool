import { DatasetFileType } from '../models/Dataset';

export function datasetS3Key(
  datasetId: string,
  fileType: 'csv' | 'jsonl',
): string {
  return `datasets/${datasetId}/${datasetId}.${fileType}`;
}

export function documentS3Key(
  datasetId: string,
  documentId: string,
  fileType: DatasetFileType,
): string {
  return `datasets/${datasetId}/${documentId}.${fileType}`;
}

export function convertedDatasetS3Key(datasetId: string): string {
  return `datasets/${datasetId}/${datasetId}-converted.jsonl`;
}
