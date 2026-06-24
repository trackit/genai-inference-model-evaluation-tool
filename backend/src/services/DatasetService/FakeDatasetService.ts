import { createInjectionToken } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors/BasicError';
import { DatasetService } from '../../ports/DatasetService';

export type StoredDatasetUpload = {
  datasetId: string;
  content: string;
  fileExtension: 'csv' | 'jsonl';
};

export class FakeDatasetService implements DatasetService {
  public readonly uploads: StoredDatasetUpload[] = [];

  async upload(
    datasetId: string,
    content: string,
    fileExtension: 'csv' | 'jsonl',
  ): Promise<void> {
    const index = this.uploads.findIndex((u) => u.datasetId === datasetId);
    const entry = { datasetId, content, fileExtension };
    if (index >= 0) {
      this.uploads[index] = entry;
    } else {
      this.uploads.push(entry);
    }
  }

  async generatePresignedPost(
    datasetId: string,
    fileExtension: 'csv' | 'jsonl',
  ): Promise<{ url: string; fields: Record<string, string> }> {
    const key = `datasets/${datasetId}.${fileExtension}`;
    return {
      url: `https://fake-s3.test/${key}`,
      fields: { key, Policy: 'fake-policy' },
    };
  }

  async retrieveDataset(
    datasetId: string,
  ): Promise<{ content: string; fileExtension: 'csv' | 'jsonl' }> {
    const stored = this.uploads.find((u) => u.datasetId === datasetId);
    if (!stored) {
      throw new BasicError(
        BasicErrorType.NOT_FOUND,
        'DATASET_NOT_FOUND',
        'Dataset not found',
        `No dataset found with ID: ${datasetId}`,
      );
    }
    return {
      content: stored.content,
      fileExtension: stored.fileExtension,
    };
  }
}

export const tokenFakeDatasetService = createInjectionToken<FakeDatasetService>(
  'FakeDatasetService',
  {
    useClass: FakeDatasetService,
  },
);
