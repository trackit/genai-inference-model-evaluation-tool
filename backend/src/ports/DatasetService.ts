export interface DatasetService {
  generatePresignedPost(
    datasetId: string,
    fileExtension: 'csv' | 'jsonl',
  ): Promise<{
    url: string;
    fields: Record<string, string>;
  }>;

  retrieveDataset(datasetId: string): Promise<{
    content: string;
    fileExtension: 'csv' | 'jsonl';
  }>;
}
