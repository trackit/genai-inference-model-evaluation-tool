import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { createInjectionToken, inject } from '@trackit.io/di-container';
import { DatasetService } from '../../ports/DatasetService';

import { BasicError, BasicErrorType } from '../../errors/BasicError';

export class DatasetServiceImpl implements DatasetService {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenClientS3);
  private readonly EXPIRY_TIME = 1800;

  async generatePresignedPost(
    datasetId: string,
    fileExtension: 'csv' | 'jsonl',
  ): Promise<{
    url: string;
    fields: Record<string, string>;
  }> {
    const s3Key = `datasets/${datasetId}.${fileExtension}`;
    const contentType =
      fileExtension === 'csv' ? 'text/csv' : 'application/jsonl';

    const { url, fields } = await createPresignedPost(this.s3Client, {
      Bucket: this.bucketName,
      Key: s3Key,
      Conditions: [
        ['content-length-range', 10, 209715200],
        ['eq', '$Content-Type', contentType],
        ['eq', '$x-amz-server-side-encryption', 'AES256'],
      ],
      Fields: {
        'Content-Type': contentType,
        'x-amz-server-side-encryption': 'AES256',
      },
      Expires: this.EXPIRY_TIME,
    });

    return { url, fields };
  }

  async retrieveDataset(datasetId: string): Promise<{
    content: string;
    fileExtension: 'csv' | 'jsonl';
  }> {
    try {
      const csvKey = `datasets/${datasetId}.csv`;
      const csvResponse = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: csvKey,
        }),
      );
      const content = await csvResponse.Body!.transformToString();
      return { content, fileExtension: 'csv' };
    } catch (error: unknown) {
      if (isS3NotFound(error)) {
        try {
          const jsonlKey = `datasets/${datasetId}.jsonl`;
          const jsonlResponse = await this.s3Client.send(
            new GetObjectCommand({
              Bucket: this.bucketName,
              Key: jsonlKey,
            }),
          );

          const content = await jsonlResponse.Body!.transformToString();
          return { content, fileExtension: 'jsonl' };
        } catch (jsonlError: unknown) {
          if (isS3NotFound(jsonlError)) {
            throw new BasicError(
              BasicErrorType.NOT_FOUND,
              'DATASET_NOT_FOUND',
              'Dataset not found',
              `No dataset found with ID: ${datasetId}`,
            );
          }
          throw jsonlError;
        }
      }
      throw error;
    }
  }
}

export const tokenClientS3 = createInjectionToken<S3Client>('ClientS3', {
  useClass: S3Client,
});

export const tokenDatasetService = createInjectionToken<DatasetService>(
  'DatasetService',
  { useClass: DatasetServiceImpl },
);

function isS3NotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'NoSuchKey' || error.name === 'NotFound')
  );
}
