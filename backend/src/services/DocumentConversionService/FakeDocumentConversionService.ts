import { createInjectionToken } from '@trackit.io/di-container';

import { DatasetFileType } from '../../models/Dataset';
import { DocumentId, FetchedDocument } from '../../models/DocumentConversion';
import { DocumentConversionService } from '../../ports/DocumentConversionService';

export type SeededDocument = {
  datasetId: string;
  documentId: DocumentId;
  fileType: DatasetFileType;
  rawContent: Buffer;
};

export class FakeDocumentConversionService implements DocumentConversionService {
  private readonly documents = new Map<string, SeededDocument>();

  seed(doc: SeededDocument): void {
    this.documents.set(`${doc.datasetId}/${doc.documentId}`, doc);
  }

  async fetchDocument(
    datasetId: string,
    documentId: DocumentId,
    fileType: DatasetFileType,
  ): Promise<FetchedDocument> {
    const doc = this.documents.get(`${datasetId}/${documentId}`);

    if (!doc) {
      throw new Error(
        `Document not found: datasetId=${datasetId}, documentId=${documentId}`,
      );
    }

    return { documentId, datasetId, fileType, rawContent: doc.rawContent };
  }
}

export const tokenFakeDocumentConversionService =
  createInjectionToken<FakeDocumentConversionService>(
    'FakeDocumentConversionService',
    { useClass: FakeDocumentConversionService },
  );
