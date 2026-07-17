import { createInjectionToken } from '@trackit.io/di-container';

import { DatasetFileType } from '../../models/Dataset';
import { DocumentConversionService } from '../../ports/DocumentConversionService';

export class FakeDocumentConversionService implements DocumentConversionService {
  public readonly parseCalls: {
    rawContent: Buffer;
    fileType: DatasetFileType;
  }[] = [];

  async parse(rawContent: Buffer, fileType: DatasetFileType): Promise<string> {
    this.parseCalls.push({
      rawContent,
      fileType,
    });

    switch (fileType) {
      case 'pdf':
      case 'doc':
      case 'docx':
        return rawContent.toString().trim();

      default:
        throw new Error(
          `Unsupported file type for parsing: "${fileType}". Supported types: pdf, doc, docx`,
        );
    }
  }
}

export const tokenFakeDocumentConversionService =
  createInjectionToken<FakeDocumentConversionService>(
    'FakeDocumentConversionService',
    { useClass: FakeDocumentConversionService },
  );
