import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import {
  GenerateSyntheticOutputsInput,
  PreprocessingTaskType,
} from '../../models/Preprocessing';
import { tokenGenerateStructuredDatasetUseCase } from '../GenerateStructuredDataset/GenerateStructuredDatasetUseCase';
import { tokenGenerateSyntheticOutputsUseCase } from '../GenerateSyntheticOutputs/GenerateSyntheticOutputsUseCase';

export interface RunSyntheticPreprocessingRequest {
  datasetId: string;
  convertedDatasetArtifactKey: string;
  taskType: PreprocessingTaskType;
  modelId?: string;
}

export interface RunSyntheticPreprocessingResult {
  datasetId: string;
  syntheticDatasetArtifactKey: string;
  structuredDatasetArtifactKey: string;
  generatedCount: number;
  failedCount: number;
  sampleCount: number;
}

export type RunSyntheticPreprocessingUseCase = {
  runSyntheticPreprocessing(
    request: RunSyntheticPreprocessingRequest,
  ): Promise<RunSyntheticPreprocessingResult>;
};

export class RunSyntheticPreprocessingUseCaseImpl implements RunSyntheticPreprocessingUseCase {
  private readonly generateSyntheticOutputs = inject(
    tokenGenerateSyntheticOutputsUseCase,
  );
  private readonly generateStructuredDataset = inject(
    tokenGenerateStructuredDatasetUseCase,
  );

  async runSyntheticPreprocessing({
    datasetId,
    convertedDatasetArtifactKey,
    taskType,
    modelId,
  }: RunSyntheticPreprocessingRequest): Promise<RunSyntheticPreprocessingResult> {
    const syntheticResult =
      await this.generateSyntheticOutputs.generateSyntheticOutputs({
        datasetId,
        convertedDatasetArtifactKey,
        taskType,
        modelId,
      } satisfies GenerateSyntheticOutputsInput);

    if (syntheticResult.failedCount > 0) {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'SYNTHETIC_GENERATION_FAILED',
        'Synthetic generation produced failed rows',
        `${syntheticResult.failedCount} row(s) failed synthetic generation`,
      );
    }

    const structuredResult =
      await this.generateStructuredDataset.generateStructuredDataset({
        datasetId,
        syntheticDatasetArtifactKey:
          syntheticResult.syntheticDatasetArtifactKey,
      });

    return {
      datasetId,
      syntheticDatasetArtifactKey: syntheticResult.syntheticDatasetArtifactKey,
      structuredDatasetArtifactKey:
        structuredResult.structuredDatasetArtifactKey,
      generatedCount: syntheticResult.generatedCount,
      failedCount: syntheticResult.failedCount,
      sampleCount: structuredResult.sampleCount,
    };
  }
}

export const tokenRunSyntheticPreprocessingUseCase =
  createInjectionToken<RunSyntheticPreprocessingUseCase>(
    'RunSyntheticPreprocessingUseCase',
    {
      useClass: RunSyntheticPreprocessingUseCaseImpl,
    },
  );
