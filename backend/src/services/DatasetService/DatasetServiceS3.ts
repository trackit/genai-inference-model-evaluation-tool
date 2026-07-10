import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { createInjectionToken, inject } from '@trackit.io/di-container';
import { z } from 'zod';
import { DatasetService } from '../../ports/DatasetService';

import { DatasetFileType } from 'backend/src/models/Dataset';
import { DocumentConversionResult } from 'backend/src/useCases/DocumentConversion/DocumentConversionUseCase';
import { documentS3Key } from 'backend/src/utils/s3Keys';
import { BasicError, BasicErrorType } from '../../errors/BasicError';
import { DocumentUploadManifest, MIN_FILE_BYTES } from '../../models/Dataset';

const DocumentUploadManifestSchema = z.object({
  max_total_bytes: z.number().int().positive(),
  files: z.array(
    z.object({
      document_id: z.string().min(1),
      filename: z.string().min(1),
      file_type: z.enum(['csv', 'jsonl', 'pdf', 'doc', 'docx']),
      s3_key: z.string().min(1),
      size_bytes: z.number().int().min(MIN_FILE_BYTES),
    }),
  ),
});

export class DatasetServiceImpl implements DatasetService {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenClientS3);
  private readonly PRESIGNED_POST_EXPIRY_SECONDS = 1800;

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
      Expires: this.PRESIGNED_POST_EXPIRY_SECONDS,
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
        Key: `datasets/${datasetId}/.upload-manifest.json`,
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
          Key: `datasets/${datasetId}/.upload-manifest.json`,
        }),
      );
      const body = await response.Body!.transformToString();
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new BasicError(
          BasicErrorType.UNPROCESSABLE_ENTITY,
          'INVALID_MANIFEST',
          'Upload manifest is not valid JSON',
        );
      }
      const result = DocumentUploadManifestSchema.safeParse(parsed);
      if (!result.success) {
        throw new BasicError(
          BasicErrorType.UNPROCESSABLE_ENTITY,
          'INVALID_MANIFEST',
          'Upload manifest has invalid structure',
          result.error.message,
        );
      }
      return result.data;
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
      const csvKey = `datasets/${datasetId}/${datasetId}.csv`;
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
          const jsonlKey = `datasets/${datasetId}/${datasetId}.jsonl`;
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

  async fetchRawContent(
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
