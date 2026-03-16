import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { Dataset, DatasetMetadata } from '../../types/Dataset';

export class DatasetService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(bucketName: string, region: string = 'us-east-1') {
    this.s3Client = new S3Client({ region });
    this.bucketName = bucketName;
  }

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

    const hasReferenceOutputs = dataset.samples.some(
      (sample) => sample.reference_output !== undefined,
    );
    const hasContext = dataset.samples.some(
      (sample) => sample.context !== undefined,
    );

    return {
      dataset_id: datasetId,
      sample_count: dataset.samples.length,
      has_reference_outputs: hasReferenceOutputs,
      has_context: hasContext,
      s3_key: s3Key,
    };
  }
}
