import { createInjectionToken } from '@trackit.io/di-container';

import { DatasetFileType } from '../../models/Dataset';
import { DocumentConversionResult, ExtractedDocument } from '../../models/DocumentConversion';
import { DocumentConversionService } from '../../ports/DocumentConversionService';

export type SeededDocument = {
  dataset_id: string;
  document_id: string;
  text: string;
};

export class FakeDocumentConversionService implements DocumentConversionService {
  private readonly documents = new Map<string, SeededDocument>();

  seed(doc: SeededDocument): void {
    this.documents.set(`${doc.dataset_id}/${doc.document_id}`, doc);
  }

  async fetchAndParse(
    dataset_id: string,
    document_id: string,
    fileType: DatasetFileType,
  ): Promise<ExtractedDocument> {
    void fileType;
    const doc = this.documents.get(`${dataset_id}/${document_id}`);

    if (!doc) {
      throw new Error(
        `Document not found: dataset_id=${dataset_id}, document_id=${document_id}`,
      );
    }

    return { document_id, text: doc.text };
  }

  async storeConversionJsonl(
    dataset_id: string,
    jsonl: string,
  ): Promise<DocumentConversionResult> {
    void jsonl;
    return { converted_dataset_file_key: `datasets/${dataset_id}/${dataset_id}-converted.jsonl` };
  }
}

export const tokenFakeDocumentConversionService =
  createInjectionToken<FakeDocumentConversionService>(
    'FakeDocumentConversionService',
    { useClass: FakeDocumentConversionService },
  );
