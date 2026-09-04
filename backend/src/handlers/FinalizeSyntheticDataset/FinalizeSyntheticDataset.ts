import { inject } from '@trackit.io/di-container';
import { z } from 'zod';

import {
  FinalizeSyntheticDatasetResult,
  tokenFinalizeSyntheticDatasetUseCase,
} from '../../useCases/FinalizeSyntheticDataset/FinalizeSyntheticDatasetUseCase';

const FinalizeSyntheticDatasetTaskInputSchema = z.object({
  datasetId: z.string().min(1),
  manifestKey: z.string().min(1),
});

export const handler = async (
  event: Record<string, unknown>,
): Promise<FinalizeSyntheticDatasetResult> => {
  const { datasetId, manifestKey } =
    FinalizeSyntheticDatasetTaskInputSchema.parse(event);

  return inject(tokenFinalizeSyntheticDatasetUseCase).execute({
    datasetId,
    manifestKey,
  });
};
