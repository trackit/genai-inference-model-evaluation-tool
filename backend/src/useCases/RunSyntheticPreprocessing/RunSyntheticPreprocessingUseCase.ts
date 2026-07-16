import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { PreprocessingTaskType } from '../../models/Preprocessing';
import { tokenGenerateStructuredDatasetUseCase } from '../GenerateStructuredDataset/GenerateStructuredDatasetUseCase';
import {
  GenerateSyntheticOutputsInput,
  GenerateSyntheticOutputsOutput,
  tokenGenerateSyntheticOutputsUseCase,
} from '../GenerateSyntheticOutputs/GenerateSyntheticOutputsUseCase';

const MAX_RETRY_ATTEMPTS = 2;

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
    let syntheticResult =
      await this.generateSyntheticOutputs.generateSyntheticOutputs({
        datasetId,
        convertedDatasetArtifactKey,
        taskType,
        modelId,
      } satisfies GenerateSyntheticOutputsInput);

    syntheticResult = await this.retryFailedWithLimit(syntheticResult, {
      datasetId,
      convertedDatasetArtifactKey,
      taskType,
      modelId,
    });

    if (syntheticResult.failedCount > 0) {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'SYNTHETIC_GENERATION_FAILED',
        'Synthetic generation produced failed rows after retries',
        `${syntheticResult.failedCount} row(s) still failed after ${MAX_RETRY_ATTEMPTS} retry attempt(s)`,
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

  private async retryFailedWithLimit(
    result: GenerateSyntheticOutputsOutput,
    params: {
      datasetId: string;
      convertedDatasetArtifactKey: string;
      taskType: PreprocessingTaskType;
      modelId?: string;
    },
  ): Promise<GenerateSyntheticOutputsOutput> {
    let current = result;

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      if (current.failedCount === 0) break;

      current = await this.generateSyntheticOutputs.retryFailedRows({
        datasetId: params.datasetId,
        syntheticDatasetArtifactKey: current.syntheticDatasetArtifactKey,
        convertedDatasetArtifactKey: params.convertedDatasetArtifactKey,
        taskType: params.taskType,
        modelId: params.modelId,
      });
    }

    return current;
  }
}

export const tokenRunSyntheticPreprocessingUseCase =
  createInjectionToken<RunSyntheticPreprocessingUseCase>(
    'RunSyntheticPreprocessingUseCase',
    {
      useClass: RunSyntheticPreprocessingUseCaseImpl,
    },
  );
