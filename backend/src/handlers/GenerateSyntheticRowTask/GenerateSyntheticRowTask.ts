import { inject } from '@trackit.io/di-container';

import {
  ConvertedDatasetRow,
  SyntheticOutputTaskType,
} from '../../models/SyntheticOutput';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';
import { tokenGenerateSyntheticOutputsUseCase } from '../../useCases/GenerateSyntheticOutputs/GenerateSyntheticOutputsUseCase';

export interface GenerateSyntheticRowTaskInput {
  datasetId: string;
  taskType: SyntheticOutputTaskType;
  row: ConvertedDatasetRow;
  modelId?: string;
}

export interface GenerateSyntheticRowTaskOutput {
  chunk_id: string;
  status: 'completed';
}

export const handler = async ({
  datasetId,
  taskType,
  row,
  modelId,
}: GenerateSyntheticRowTaskInput): Promise<GenerateSyntheticRowTaskOutput> => {
  const useCase = inject(tokenGenerateSyntheticOutputsUseCase);
  const datasetService = inject(tokenDatasetService);

  const generated = await useCase.generateSyntheticRow({
    convertedRow: row,
    taskType,
    modelId,
  });

  await datasetService.writeSyntheticRow(datasetId, row.chunk_id, generated);

  return { chunk_id: row.chunk_id, status: 'completed' };
};
