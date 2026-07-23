import { inject } from '@trackit.io/di-container';

import { ChunkingStrategy } from '../../models/DocumentConversion';
import { SyntheticOutputTaskType } from '../../models/SyntheticOutput';
import { tokenDocumentConversionUseCase } from '../../useCases/DocumentConversion/DocumentConversionUseCase';

export interface DocumentConversionTaskInput {
  datasetId: string;
  taskType: SyntheticOutputTaskType;
  chunkingStrategy: ChunkingStrategy;
}

export interface DocumentConversionTaskOutput {
  datasetId: string;
  taskType: SyntheticOutputTaskType;
  convertedDatasetArtifactKey: string;
}

/**
 * Step Functions task: parses the dataset's uploaded documents into a converted
 * JSONL artifact. Invoked with a plain JSON payload (not an API Gateway event).
 */
export const handler = async ({
  datasetId,
  taskType,
  chunkingStrategy,
}: DocumentConversionTaskInput): Promise<DocumentConversionTaskOutput> => {
  const convertedDatasetArtifactKey = await inject(
    tokenDocumentConversionUseCase,
  ).execute({
    dataset_id: datasetId,
    chunking_strategy: chunkingStrategy,
  });

  return { datasetId, taskType, convertedDatasetArtifactKey };
};
