import { inject } from '@trackit.io/di-container';
import { z } from 'zod';

import { SYNTHETIC_OUTPUT_TASK_TYPES } from '../../models/SyntheticOutput';
import {
  RunSyntheticPreprocessingResult,
  tokenRunSyntheticPreprocessingUseCase,
} from '../../useCases/RunSyntheticPreprocessing/RunSyntheticPreprocessingUseCase';

const RunSyntheticPreprocessingTaskInputSchema = z.object({
  datasetId: z.string().min(1),
  taskType: z.enum(SYNTHETIC_OUTPUT_TASK_TYPES),
  convertedDatasetArtifactKey: z.string().min(1),
  modelId: z.string().min(1).optional(),
});

/**
 * Step Functions task: generates synthetic outputs (with retries) and assembles
 * the final structured dataset. Invoked with a plain JSON payload.
 */
export const handler = async (
  event: Record<string, unknown>,
): Promise<RunSyntheticPreprocessingResult> => {
  const { datasetId, taskType, convertedDatasetArtifactKey, modelId } =
    RunSyntheticPreprocessingTaskInputSchema.parse(event);

  return inject(tokenRunSyntheticPreprocessingUseCase).runSyntheticPreprocessing(
    {
      datasetId,
      convertedDatasetArtifactKey,
      taskType,
      modelId,
    },
  );
};
