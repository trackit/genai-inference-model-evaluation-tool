import { DatasetFileType } from '../models/Dataset';
import { ExtractedDocument } from '../models/DocumentConversion';

export interface DocumentConversionService {
  /**
   * Fetches a document by its key and extracts plain text from it.
   * The key is constructed as documents/{datasetId}/{documentId}.{ext}.
   */
  fetchAndParse(
    dataset_id: string,
    document_id: string,
    file_type: DatasetFileType,
  ): Promise<ExtractedDocument>;
}
