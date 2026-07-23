import { createInjectionToken, inject } from '@trackit.io/di-container';

import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';
import { tokenGenerateStructuredDatasetUseCase } from '../GenerateStructuredDataset/GenerateStructuredDatasetUseCase';

export interface CombineAndStructureTaskInput {
  datasetId: string;
}

export interface CombineAndStructureTaskOutput {
  datasetId: string;
  structuredDatasetArtifactKey: string;
  sampleCount: number;
}

export type CombineAndStructureTaskUseCase = {
  execute(
    input: CombineAndStructureTaskInput,
  ): Promise<CombineAndStructureTaskOutput>;
};

export class CombineAndStructureTaskUseCaseImpl implements CombineAndStructureTaskUseCase {
  private readonly datasetService = inject(tokenDatasetService);
  private readonly generateStructuredDataset = inject(
    tokenGenerateStructuredDatasetUseCase,
  );

  async execute({
    datasetId,
  }: CombineAndStructureTaskInput): Promise<CombineAndStructureTaskOutput> {
    const rows = await this.datasetService.readSyntheticRows(datasetId);
    const { syntheticDatasetArtifactKey } =
      await this.datasetService.writeSyntheticDataset(datasetId, rows);

    const { structuredDatasetArtifactKey, sampleCount } =
      await this.generateStructuredDataset.generateStructuredDataset({
        datasetId,
        syntheticDatasetArtifactKey,
      });

    return { datasetId, structuredDatasetArtifactKey, sampleCount };
  }
}

export const tokenCombineAndStructureTaskUseCase =
  createInjectionToken<CombineAndStructureTaskUseCase>(
    'CombineAndStructureTaskUseCase',
    { useClass: CombineAndStructureTaskUseCaseImpl },
  );
