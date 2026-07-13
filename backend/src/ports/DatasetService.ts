import { DocumentUploadManifest } from '../models/Dataset';
export interface DatasetService {
  generatePresignedPost(
    location: string,
    contentType: string,
    maxBytes: number,
  ): Promise<{
    url: string;
    fields: Record<string, string>;
  }>;

  writeUploadManifest(
    datasetId: string,
    manifest: DocumentUploadManifest,
  ): Promise<void>;

  readUploadManifest(datasetId: string): Promise<DocumentUploadManifest | null>;

  getUploadedObjectSize(location: string): Promise<number>;

  retrieveDataset(datasetId: string): Promise<{
    content: string;
    fileExtension: 'csv' | 'jsonl';
  }>;

  /**
   * Stores the converted dataset in S3 and returns the S3 key of the stored JSONL file.
   */
  storeConversionJsonl(
    convertedDatasetFileKey: string,
    jsonl: string,
  ): Promise<string>;

  /**
   * Fetches the raw content of a document from S3 based on the provided document key.
   */
  fetchRawContent(documentKey: string): Promise<Buffer>;
}
