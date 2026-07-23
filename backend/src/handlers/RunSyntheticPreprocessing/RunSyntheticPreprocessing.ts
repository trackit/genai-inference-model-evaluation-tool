import { inject } from '@trackit.io/di-container';

import { SyntheticOutputTaskType } from '../../models/SyntheticOutput';
import {
  RunSyntheticPreprocessingResult,
  tokenRunSyntheticPreprocessingUseCase,
} from '../../useCases/RunSyntheticPreprocessing/RunSyntheticPreprocessingUseCase';

export interface RunSyntheticPreprocessingTaskInput {
  datasetId: string;
  taskType: SyntheticOutputTaskType;
  convertedDatasetArtifactKey: string;
  modelId?: string;
}

/**
 * Step Functions task: generates synthetic outputs (with retries) and assembles
 * the final structured dataset. Invoked with a plain JSON payload.
 */
export const handler = async ({
  datasetId,
  taskType,
  convertedDatasetArtifactKey,
  modelId,
}: RunSyntheticPreprocessingTaskInput): Promise<RunSyntheticPreprocessingResult> =>
  inject(tokenRunSyntheticPreprocessingUseCase).runSyntheticPreprocessing({
    datasetId,
    convertedDatasetArtifactKey,
    taskType,
    modelId,
  });
