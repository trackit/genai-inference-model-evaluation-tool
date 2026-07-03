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
}
