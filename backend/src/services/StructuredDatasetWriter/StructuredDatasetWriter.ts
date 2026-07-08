import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { DatasetSample } from '../../models/Dataset';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';

export interface StructuredDatasetWriter {
  writeStructuredDataset(
    datasetId: string,
    samples: DatasetSample[],
  ): Promise<{ structuredDatasetArtifactKey: string }>;
}

export class StructuredDatasetWriterS3 implements StructuredDatasetWriter {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenClientS3);

  async writeStructuredDataset(
    datasetId: string,
    samples: DatasetSample[],
  ): Promise<{ structuredDatasetArtifactKey: string }> {
    if (!datasetId.trim()) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'DATASET_ID_REQUIRED',
        'Dataset ID is required',
      );
    }

    const structuredDatasetArtifactKey = `datasets/${datasetId}.jsonl`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: structuredDatasetArtifactKey,
        Body: serializeSamples(samples),
        ContentType: 'application/jsonl',
        ServerSideEncryption: 'AES256',
      }),
    );

    return { structuredDatasetArtifactKey };
  }
}

export const tokenStructuredDatasetWriter =
  createInjectionToken<StructuredDatasetWriter>('StructuredDatasetWriter', {
    useClass: StructuredDatasetWriterS3,
  });

function serializeSamples(samples: DatasetSample[]): string {
  if (samples.length === 0) return '';

  return `${samples
    .map((sample) =>
      JSON.stringify({
        document: sample.document,
        ...(sample.summary !== undefined && { summary: sample.summary }),
        ...(sample.class_label !== undefined && { class: sample.class_label }),
      }),
    )
    .join('\n')}\n`;
}
