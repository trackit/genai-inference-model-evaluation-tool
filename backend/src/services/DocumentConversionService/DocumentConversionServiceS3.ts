import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createInjectionToken, inject } from '@trackit.io/di-container';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import WordExtractor from 'word-extractor';

import { DatasetFileType } from '../../models/Dataset';
import {
  DocumentConversionResult,
  ExtractedDocument,
} from '../../models/DocumentConversion';
import { DocumentConversionService } from '../../ports/DocumentConversionService';
import { documentS3Key } from '../../utils/s3Keys';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';

export class DocumentConversionServiceImpl implements DocumentConversionService {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenClientS3);
  private readonly wordExtractor = new WordExtractor();

  async fetchAndParse(
    dataset_id: string,
    document_id: string,
    file_type: DatasetFileType,
  ): Promise<ExtractedDocument> {
    const rawContent = await this.fetchRawContent(
      dataset_id,
      document_id,
      file_type,
    );
    const text = await this.extractText(rawContent, file_type);

    return { document_id, text: text.trim() };
  }

  async storeConversionJsonl(
    dataset_id: string,
    jsonl: string,
  ): Promise<DocumentConversionResult> {
    const documentConversionResult: DocumentConversionResult = {
      converted_dataset_file_key: `datasets/${dataset_id}/${dataset_id}-converted.jsonl`,
    };

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: documentConversionResult.converted_dataset_file_key,
        Body: jsonl,
        ContentType: 'application/jsonl',
        ServerSideEncryption: 'AES256',
      }),
    );

    return documentConversionResult;
  }

  private async fetchRawContent(
    dataset_id: string,
    document_id: string,
    file_type: DatasetFileType,
  ): Promise<Buffer> {
    const key = documentS3Key(dataset_id, document_id, file_type);

    const response = await this.s3Client.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
    );

    return Buffer.from(await response.Body!.transformToByteArray());
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
