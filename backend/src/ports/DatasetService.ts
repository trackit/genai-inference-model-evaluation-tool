import { DatasetFileType, DocumentUploadManifest } from '../models/Dataset';

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
   * Stores the converted dataset in JSONL format and returns the path to the stored file.
   */
  storeConversionJsonl(datasetId: string, jsonl: string): Promise<string>;

  /**
   * Fetches the raw content of a document in the dataset and returns it as a Buffer.
   */
  fetchRawContent(
    datasetId: string,
    documentId: string,
    fileType: DatasetFileType,
  ): Promise<Buffer>;
}
