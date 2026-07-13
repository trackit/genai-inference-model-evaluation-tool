import { DatasetFileType } from '../models/Dataset';

export interface DocumentConversionService {
  /**
   * Parses a document and extracts its content.
   */
  parse(
    rawContent: Buffer<ArrayBufferLike>,
    file_type: DatasetFileType,
  ): Promise<string>;
}
