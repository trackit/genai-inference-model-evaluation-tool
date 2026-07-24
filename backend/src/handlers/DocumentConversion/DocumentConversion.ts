import { inject } from '@trackit.io/di-container';
import { z } from 'zod';

import { ChunkingStrategy } from '../../models/DocumentConversion';
import {
  SYNTHETIC_OUTPUT_TASK_TYPES,
  SyntheticOutputTaskType,
} from '../../models/SyntheticOutput';
import { tokenDocumentConversionUseCase } from '../../useCases/DocumentConversion/DocumentConversionUseCase';

const DocumentConversionTaskInputSchema = z.object({
  datasetId: z.string().min(1),
  taskType: z.enum(SYNTHETIC_OUTPUT_TASK_TYPES),
  chunkingStrategy: z.enum(ChunkingStrategy),
});

export interface DocumentConversionTaskOutput {
  datasetId: string;
  taskType: SyntheticOutputTaskType;
  convertedDatasetArtifactKey: string;
}

/**
 * Step Functions task: parses the dataset's uploaded documents into a converted
 * JSONL artifact. Invoked with a plain JSON payload (not an API Gateway event).
 */
export const handler = async (
  event: Record<string, unknown>,
): Promise<DocumentConversionTaskOutput> => {
  const { datasetId, taskType, chunkingStrategy } =
    DocumentConversionTaskInputSchema.parse(event);

  const convertedDatasetArtifactKey = await inject(
    tokenDocumentConversionUseCase,
  ).execute({
    dataset_id: datasetId,
    chunking_strategy: chunkingStrategy,
  });

  return { datasetId, taskType, convertedDatasetArtifactKey };
};
