import type { DatasetSample } from '../models/Dataset';
import { DatasetFileType, DocumentUploadManifest } from '../models/Dataset';
import type {
  ConvertedDatasetRow,
  SyntheticOutputRow,
} from '../models/SyntheticOutput';

export interface DatasetService {
  generatePresignedPost(
    datasetId: string,
    fileType: DatasetFileType,
    contentType: string,
    maxBytes: number,
    documentId?: string,
  ): Promise<{
    url: string;
    fields: Record<string, string>;
    key: string;
  }>;

  writeUploadManifest(
    datasetId: string,
    manifest: DocumentUploadManifest,
  ): Promise<void>;

  readUploadManifest(datasetId: string): Promise<DocumentUploadManifest | null>;

  getUploadedObjectSize(location: string): Promise<number>;

  retrieveDataset(
    datasetId: string,
    file_type: 'csv' | 'jsonl',
  ): Promise<string>;

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

  readConvertedDatasetRows(
    convertedDatasetArtifactKey: string,
  ): Promise<ConvertedDatasetRow[]>;

  writeSyntheticDataset(
    datasetId: string,
    rows: SyntheticOutputRow[],
  ): Promise<{ syntheticDatasetArtifactKey: string }>;

  readSyntheticDatasetRows(
    syntheticDatasetArtifactKey: string,
  ): Promise<SyntheticOutputRow[]>;

  writeStructuredDataset(
    datasetId: string,
    samples: DatasetSample[],
  ): Promise<{ structuredDatasetArtifactKey: string }>;
}
