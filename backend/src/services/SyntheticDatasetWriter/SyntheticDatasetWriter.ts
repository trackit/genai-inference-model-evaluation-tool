import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { SyntheticOutputRow } from '../../models/Preprocessing';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';

export interface SyntheticDatasetWriter {
  writeSyntheticDataset(
    datasetId: string,
    rows: SyntheticOutputRow[],
  ): Promise<{ syntheticDatasetArtifactKey: string }>;
}

export class SyntheticDatasetWriterS3 implements SyntheticDatasetWriter {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenClientS3);

  async writeSyntheticDataset(
    datasetId: string,
    rows: SyntheticOutputRow[],
  ): Promise<{ syntheticDatasetArtifactKey: string }> {
    if (!datasetId.trim()) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'DATASET_ID_REQUIRED',
        'Dataset ID is required',
      );
    }

    const syntheticDatasetArtifactKey =
      buildSyntheticDatasetArtifactKey(datasetId);
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: syntheticDatasetArtifactKey,
        Body: serializeSyntheticRows(rows),
        ContentType: 'application/jsonl',
        ServerSideEncryption: 'AES256',
      }),
    );

    return { syntheticDatasetArtifactKey };
  }
}

export const tokenSyntheticDatasetWriter =
  createInjectionToken<SyntheticDatasetWriter>('SyntheticDatasetWriter', {
    useClass: SyntheticDatasetWriterS3,
  });

function buildSyntheticDatasetArtifactKey(datasetId: string): string {
  return `datasets/${datasetId}/${datasetId}-synthetic.jsonl`;
}

function serializeSyntheticRows(rows: SyntheticOutputRow[]): string {
  if (rows.length === 0) return '';
  return `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
}
