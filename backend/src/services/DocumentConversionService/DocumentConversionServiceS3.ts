import { createInjectionToken, inject } from '@trackit.io/di-container';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import WordExtractor from 'word-extractor';

import { DatasetFileType } from '../../models/Dataset';
import { ExtractedDocument } from '../../models/DocumentConversion';
import { DocumentConversionService } from '../../ports/DocumentConversionService';
import { tokenClientS3, tokenDatasetService } from '../DatasetService/DatasetServiceS3';

export class DocumentConversionServiceImpl implements DocumentConversionService {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenClientS3);
  private readonly datasetService = inject(tokenDatasetService);
  private readonly wordExtractor = new WordExtractor();

  async fetchAndParse(
    dataset_id: string,
    document_id: string,
    file_type: DatasetFileType,
  ): Promise<ExtractedDocument> {
    const rawContent = await this.datasetService.fetchRawContent(
      dataset_id,
      document_id,
      file_type,
    );
    const text = await this.extractText(rawContent, file_type);

    return { document_id, text: text.trim() };
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
        return document.getBody();
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
