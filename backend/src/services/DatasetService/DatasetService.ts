import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createInjectionToken, inject } from '@trackit.io/di-container';
import { randomUUID } from 'crypto';
import { Dataset, DatasetMetadata } from '../../models/Dataset';

export type DatasetService = {
  uploadDataset(
    content: string,
    fileExtension: 'csv' | 'jsonl',
    dataset: Dataset,
  ): Promise<DatasetMetadata>;
};

export const tokenS3Client = createInjectionToken<S3Client>('S3Client', {
  useClass: S3Client,
});

class DatasetServiceImpl implements DatasetService {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenS3Client);

  async uploadDataset(
    content: string,
    fileExtension: 'csv' | 'jsonl',
    dataset: Dataset,
  ): Promise<DatasetMetadata> {
    const datasetId = randomUUID();
    const s3Key = `datasets/${datasetId}.${fileExtension}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: content,
        ContentType: fileExtension === 'csv' ? 'text/csv' : 'application/jsonl',
        ServerSideEncryption: 'AES256',
      }),
    );

    const hasSummary = dataset.samples.some((s) => s.summary !== undefined);
    const hasClass = dataset.samples.some((s) => s.class_label !== undefined);

    return {
      dataset_id: datasetId,
      sample_count: dataset.samples.length,
      has_summary: hasSummary,
      has_class: hasClass,
      s3_key: s3Key,
    };
  }
}

export const tokenDatasetService = createInjectionToken<DatasetService>(
  'DatasetService',
  { useClass: DatasetServiceImpl },
);