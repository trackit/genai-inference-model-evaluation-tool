import { createInjectionToken } from '@trackit.io/di-container';
import { randomUUID } from 'crypto';
import { Dataset, DatasetMetadata } from '../../models/Dataset';
import { DatasetService } from '../../ports/DatasetService';

export type StoredDatasetUpload = {
  content: string;
  fileExtension: 'csv' | 'jsonl';
  dataset: Dataset;
};

export class FakeDatasetService implements DatasetService {
  public readonly uploads: StoredDatasetUpload[] = [];

  async uploadDataset(
    content: string,
    fileExtension: 'csv' | 'jsonl',
    dataset: Dataset,
  ): Promise<DatasetMetadata> {
    this.uploads.push({ content, fileExtension, dataset });

    const datasetId = randomUUID();
    const hasSummary = dataset.samples.some((s) => s.summary !== undefined);
    const hasClass = dataset.samples.some((s) => s.class_label !== undefined);

    return {
      dataset_id: datasetId,
      sample_count: dataset.samples.length,
      has_summary: hasSummary,
      has_class: hasClass,
      s3_key: `datasets/${datasetId}.${fileExtension}`,
    };
  }
}

export const tokenFakeDatasetService = createInjectionToken<FakeDatasetService>(
  'FakeDatasetService',
  {
    useClass: FakeDatasetService,
  },
);
