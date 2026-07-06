import { DatasetFileType } from '../models/Dataset';
import { DocumentId, FetchedDocument } from '../models/DocumentConversion';

export interface DocumentConversionService {
  /**
   * Fetches the raw bytes of a document from S3.
   * The S3 key is constructed as documents/{datasetId}/{documentId}.{ext}
   * using the manifest entry's file_type.
   */
  fetchDocument(
    datasetId: string,
    documentId: DocumentId,
    fileType: DatasetFileType,
  ): Promise<FetchedDocument>;
}
