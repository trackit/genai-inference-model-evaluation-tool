import { BasicError, BasicErrorType } from '../errors';
import { DocumentChunk, ExtractedDocument } from '../models/DocumentConversion';

export function chunkDocumentByCustomDelimiter(
  document: ExtractedDocument,
  delimiter: string,
): DocumentChunk[] {
  if (!document.text.trim()) {
    return [];
  }

  const chunks = document.text
    .split(delimiter)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.map((text, index) => ({
    document_id: document.document_id,
    chunk_id: `${document.document_id}-${index}`,
    text,
  }));
}

export function validateCustomDelimiter(delimiter: string | undefined): void {
  if (delimiter === undefined) return;
  if (delimiter.length === 0 || delimiter.length > 50) {
    throw new BasicError(
      BasicErrorType.BAD_REQUEST,
      'INVALID_DELIMITER',
      'Custom delimiter must be between 1 and 50 characters',
      `Received delimiter of length ${delimiter.length}`,
    );
  }
  if (delimiter.trim().length === 0) {
    throw new BasicError(
      BasicErrorType.BAD_REQUEST,
      'INVALID_DELIMITER',
      'Custom delimiter must not be whitespace only',
      `Received delimiter: "${delimiter}"`,
    );
  }
}
