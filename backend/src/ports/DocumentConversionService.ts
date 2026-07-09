import { DatasetFileType } from '../models/Dataset';
import {
  DocumentConversionResult,
  ExtractedDocument,
} from '../models/DocumentConversion';

export interface DocumentConversionService {
  /**
   * Fetches a document from S3 by its key and extracts plain text from it.
   * The S3 key is constructed as documents/{datasetId}/{documentId}.{ext}.
   */
  fetchAndParse(
    dataset_id: string,
    document_id: string,
    file_type: DatasetFileType,
  ): Promise<ExtractedDocument>;

  /**
   * Stores generated JSONL for a converted document dataset
   * and returns the S3 key which is datasets/{datasetId}/{datasetId}-converted.jsonl.
   */
  storeConversionJsonl(
    datasetId: string,
    jsonl: string,
  ): Promise<DocumentConversionResult>;
}
