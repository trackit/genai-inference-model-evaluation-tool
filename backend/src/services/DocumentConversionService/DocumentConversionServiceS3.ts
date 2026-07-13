import { createInjectionToken } from '@trackit.io/di-container';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import WordExtractor from 'word-extractor';

import { DatasetFileType } from '../../models/Dataset';
import { DocumentConversionService } from '../../ports/DocumentConversionService';

export class DocumentConversionServiceImpl implements DocumentConversionService {
  private readonly wordExtractor = new WordExtractor();

  async parse(
    rawContent: Buffer<ArrayBufferLike>,
    file_type: DatasetFileType,
  ): Promise<string> {
    const text = await this.extractText(rawContent, file_type);

    return text.trim();
  }

  private async extractText(
    raw_content: Buffer,
    file_type: DatasetFileType,
  ): Promise<string> {
    switch (file_type) {
      case 'pdf': {
        const parser = new PDFParse({ data: new Uint8Array(raw_content) });
        const result = await parser.getText();
        return result.text;
      }

      case 'doc': {
        const document = await this.wordExtractor.extract(raw_content);
        return document.getBody().replace(/\n/g, '\n\n');
      }

      case 'docx': {
        const result = await mammoth.extractRawText({ buffer: raw_content });
        return result.value;
      }

      default:
        throw new Error(
          `Unsupported file type for parsing: "${file_type}". ` +
            `Supported types: pdf, doc, docx`,
        );
    }
  }
}

export const tokenDocumentConversionService =
  createInjectionToken<DocumentConversionService>('DocumentConversionService', {
    useClass: DocumentConversionServiceImpl,
  });
