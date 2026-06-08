import { Dataset, DatasetMetadata } from 'backend/src/models/Dataset';

export interface DatasetService {
  uploadDataset(
    content: string,
    fileExtension: 'csv' | 'jsonl',
    dataset: Dataset,
  ): Promise<DatasetMetadata>;
}
