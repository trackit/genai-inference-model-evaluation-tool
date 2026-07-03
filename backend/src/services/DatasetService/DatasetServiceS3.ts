import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { createInjectionToken, inject } from '@trackit.io/di-container';
import { DatasetService } from '../../ports/DatasetService';

import { BasicError, BasicErrorType } from '../../errors/BasicError';
import { DocumentUploadManifest, MIN_FILE_BYTES } from '../../models/Dataset';

export class DatasetServiceImpl implements DatasetService {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenClientS3);
  private readonly EXPIRY_TIME = 1800;

  async generatePresignedPost(
    location: string,
    contentType: string,
    maxBytes: number,
  ): Promise<{
    url: string;
    fields: Record<string, string>;
  }> {
    const { url, fields } = await createPresignedPost(this.s3Client, {
      Bucket: this.bucketName,
      Key: location,
      Conditions: [
        ['content-length-range', MIN_FILE_BYTES, maxBytes],
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

  async writeUploadManifest(
    datasetId: string,
    manifest: DocumentUploadManifest,
  ): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `documents/${datasetId}/.upload-manifest.json`,
        Body: JSON.stringify(manifest),
        ContentType: 'application/json',
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async readUploadManifest(
    datasetId: string,
  ): Promise<DocumentUploadManifest | null> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: `documents/${datasetId}/.upload-manifest.json`,
        }),
      );
      const body = await response.Body!.transformToString();
      return JSON.parse(body) as DocumentUploadManifest;
    } catch (error: unknown) {
      if (isS3NotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  async getUploadedObjectSize(s3Key: string): Promise<number> {
    try {
      const response = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
        }),
      );
      return response.ContentLength ?? 0;
    } catch (error: unknown) {
      if (isS3NotFound(error)) {
        throw new BasicError(
          BasicErrorType.UNPROCESSABLE_ENTITY,
          'UPLOAD_INCOMPLETE',
          'One or more files were not uploaded',
          `Missing object: ${s3Key}`,
        );
      }
      throw error;
    }
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

  async listDocuments(datasetId: string): Promise<string[]> {
    try {
      const prefix = `documents/${datasetId}/`;
      const allKeys: string[] = [];
      let continuationToken: string | undefined;

      do {
        const response = await this.s3Client.send(
          new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        );

        if (!response.Contents || response.Contents.length === 0) {
          break;
        }

        const pageKeys = response.Contents.map(
          (object) => object.Key || '',
        ).filter((key) => key !== '');
        allKeys.push(...pageKeys);

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return allKeys;
    } catch (error: unknown) {
      if (isS3NotFound(error)) {
        return [];
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
