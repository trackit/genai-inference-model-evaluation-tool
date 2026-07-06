import { DatasetFileType } from '../models/Dataset';

export function datasetS3Key(
  datasetId: string,
  fileType: 'csv' | 'jsonl',
): string {
  return `datasets/${datasetId}.${fileType}`;
}

export function documentS3Key(
  datasetId: string,
  documentId: string,
  fileType: DatasetFileType,
): string {
  return `documents/${datasetId}/${documentId}.${fileType}`;
}
