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
  customDelimiter: z.string().min(1).max(50).optional(),
});

export interface DocumentConversionTaskOutput {
  datasetId: string;
  taskType: SyntheticOutputTaskType;
  convertedDatasetArtifactKey: string;
}

export const handler = async (
  event: Record<string, unknown>,
): Promise<DocumentConversionTaskOutput> => {
  const { datasetId, taskType, chunkingStrategy, customDelimiter } =
    DocumentConversionTaskInputSchema.parse(event);

  const convertedDatasetArtifactKey = await inject(
    tokenDocumentConversionUseCase,
  ).execute({
    dataset_id: datasetId,
    chunking_strategy: chunkingStrategy,
    custom_delimiter: customDelimiter,
  });

  return { datasetId, taskType, convertedDatasetArtifactKey };
};
