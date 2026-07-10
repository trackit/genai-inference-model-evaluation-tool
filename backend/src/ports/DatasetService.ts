import { DatasetFileType, DocumentUploadManifest } from '../models/Dataset';
import { DocumentConversionResult } from '../useCases/DocumentConversion/DocumentConversionUseCase';

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
   * Stores generated JSONL for a converted document dataset
   * and returns the key which is datasets/{datasetId}/{datasetId}-converted.jsonl.
   */
  storeConversionJsonl(
    datasetId: string,
    jsonl: string,
  ): Promise<DocumentConversionResult>;

  fetchRawContent(
    dataset_id: string,
    document_id: string,
    file_type: DatasetFileType,
  ): Promise<Buffer>;
}
