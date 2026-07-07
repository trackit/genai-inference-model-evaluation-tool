import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { createInjectionToken, inject } from '@trackit.io/di-container';

import { DatasetFileType } from '../../models/Dataset';
import { DocumentConversionResult, DocumentId, ExtractedDocument } from '../../models/DocumentConversion';
import { DocumentConversionService } from '../../ports/DocumentConversionService';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';
import { documentS3Key } from '../../utils/s3Keys';

export class DocumentConversionServiceImpl implements DocumentConversionService {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenClientS3);

  async fetchAndParse(
    datasetId: string,
    documentId: DocumentId,
    fileType: DatasetFileType,
  ): Promise<ExtractedDocument> {
    const rawContent = await this.fetchRawContent(datasetId, documentId, fileType);
    const text = await this.extractText(rawContent, fileType);

    return { documentId, text: text.trim() };
  }

  async storeConversionJsonl(datasetId: string, jsonl: string): Promise<DocumentConversionResult> {
    const documentConversionResult: DocumentConversionResult = { S3key: `datasets/${datasetId}/${datasetId}-converted.jsonl` };

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: documentConversionResult.S3key,
        Body: jsonl,
        ContentType: 'application/jsonl',
        ServerSideEncryption: 'AES256',
      }),
    );

    return documentConversionResult;
  }

  private async fetchRawContent(
    datasetId: string,
    documentId: DocumentId,
    fileType: DatasetFileType,
  ): Promise<Buffer> {
    const key = documentS3Key(datasetId, documentId, fileType);

    const response = await this.s3Client.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
    );

    return Buffer.from(await response.Body!.transformToByteArray());
  }

  private async extractText(
    rawContent: Buffer,
    fileType: DatasetFileType,
  ): Promise<string> {
    switch (fileType) {
      case 'pdf': {
        const parser = new PDFParse({ data: new Uint8Array(rawContent) });
        const result = await parser.getText();
        return result.text;
      }

      case 'doc':
      case 'docx': {
        const result = await mammoth.extractRawText({ buffer: rawContent });
        return result.value;
      }

      default:
        throw new Error(
          `Unsupported file type for parsing: "${fileType}". ` +
            `Supported types: pdf, doc, docx`,
        );
    }
  }
}

export const tokenDocumentConversionService =
  createInjectionToken<DocumentConversionService>('DocumentConversionService', {
    useClass: DocumentConversionServiceImpl,
  });
