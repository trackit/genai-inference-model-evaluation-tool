import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createInjectionToken, inject } from '@trackit.io/di-container';

import { DatasetFileType } from '../../models/Dataset';
import { DocumentId, FetchedDocument } from '../../models/DocumentConversion';
import { DocumentConversionService } from '../../ports/DocumentConversionService';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';
import { documentS3Key } from '../../utils/s3Keys';

export class DocumentConversionServiceImpl implements DocumentConversionService {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenClientS3);

  async fetchDocument(
    datasetId: string,
    documentId: DocumentId,
    fileType: DatasetFileType,
  ): Promise<FetchedDocument> {
    const key = documentS3Key(datasetId, documentId, fileType);

    const response = await this.s3Client.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
    );

    const rawContent = Buffer.from(
      await response.Body!.transformToByteArray(),
    );

    return { documentId, datasetId, fileType, rawContent };
  }
}

export const tokenDocumentConversionService =
  createInjectionToken<DocumentConversionService>('DocumentConversionService', {
    useClass: DocumentConversionServiceImpl,
  });
