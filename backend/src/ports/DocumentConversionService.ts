import { DatasetFileType } from '../models/Dataset';
import { DocumentConversionResult, DocumentId, ExtractedDocument } from '../models/DocumentConversion';

export interface DocumentConversionService {
  /**
   * Fetches a document from S3 by its key and extracts plain text from it.
   * The S3 key is constructed as documents/{datasetId}/{documentId}.{ext}.
   */
  fetchAndParse(
    datasetId: string,
    documentId: DocumentId,
    fileType: DatasetFileType,
  ): Promise<ExtractedDocument>;

  /**
   * Stores generated JSONL for a converted document dataset 
   * and returns the S3 key which is datasets/{datasetId}-converted.jsonl.
   */
  storeConversionJsonl(datasetId: string, jsonl: string): Promise<DocumentConversionResult>;
}
