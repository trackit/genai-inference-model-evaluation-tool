import { Dataset, DatasetMetadata } from '../models/Dataset';

export interface DatasetService {
  uploadDataset(
    content: string,
    fileExtension: 'csv' | 'jsonl',
    dataset: Dataset,
  ): Promise<DatasetMetadata>;
}
