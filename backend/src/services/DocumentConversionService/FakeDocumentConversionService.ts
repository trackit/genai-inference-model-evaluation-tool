import { createInjectionToken } from '@trackit.io/di-container';

import { DatasetFileType } from '../../models/Dataset';
import {
  DocumentConversionResult,
  DocumentId,
  ExtractedDocument,
} from '../../models/DocumentConversion';
import { DocumentConversionService } from '../../ports/DocumentConversionService';

export type SeededDocument = {
  datasetId: string;
  documentId: DocumentId;
  text: string;
};

export class FakeDocumentConversionService implements DocumentConversionService {
  private readonly documents = new Map<string, SeededDocument>();

  seed(doc: SeededDocument): void {
    this.documents.set(`${doc.datasetId}/${doc.documentId}`, doc);
  }

  async fetchAndParse(
    datasetId: string,
    documentId: DocumentId,
    _fileType: DatasetFileType,
  ): Promise<ExtractedDocument> {
    const doc = this.documents.get(`${datasetId}/${documentId}`);

    if (!doc) {
      throw new Error(
        `Document not found: datasetId=${datasetId}, documentId=${documentId}`,
      );
    }

    return { documentId, text: doc.text };
  }

  async storeConversionJsonl(
    datasetId: string,
    jsonl: string,
  ): Promise<DocumentConversionResult> {
    return { S3key: `datasets/${datasetId}-converted.jsonl` };
  }
}

export const tokenFakeDocumentConversionService =
  createInjectionToken<FakeDocumentConversionService>(
    'FakeDocumentConversionService',
    { useClass: FakeDocumentConversionService },
  );
