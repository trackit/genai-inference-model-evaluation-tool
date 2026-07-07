import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import {
  ConvertedDatasetRow,
  GenerateSyntheticOutputsInput,
  GenerateSyntheticOutputsOutput,
  PreprocessingTaskType,
  SyntheticOutputRow,
} from '../../models/Preprocessing';
import { tokenSyntheticOutputModelClient } from '../../ports/SyntheticOutputModelClient';
import { tokenPreprocessingChunkReader } from '../../services/PreprocessingChunkReader/PreprocessingChunkReader';
import { tokenSyntheticDatasetWriter } from '../../services/SyntheticDatasetWriter/SyntheticDatasetWriter';
import { tokenSyntheticOutputPromptBuilder } from '../../services/SyntheticOutputPromptBuilder/SyntheticOutputPromptBuilder';

export type GenerateSyntheticOutputsUseCase = {
  generateSyntheticOutputs(
    input: GenerateSyntheticOutputsInput,
  ): Promise<GenerateSyntheticOutputsOutput>;
};

export class GenerateSyntheticOutputsUseCaseImpl implements GenerateSyntheticOutputsUseCase {
  private readonly convertedRowReader = inject(tokenPreprocessingChunkReader);
  private readonly promptBuilder = inject(tokenSyntheticOutputPromptBuilder);
  private readonly modelClient = inject(tokenSyntheticOutputModelClient);
  private readonly syntheticDatasetWriter = inject(tokenSyntheticDatasetWriter);

  async generateSyntheticOutputs({
    datasetId,
    convertedDatasetArtifactKey,
    taskType,
    modelId,
  }: GenerateSyntheticOutputsInput): Promise<GenerateSyntheticOutputsOutput> {
    const convertedRows = await this.convertedRowReader.readConvertedRows(
      convertedDatasetArtifactKey,
    );

    const rows: SyntheticOutputRow[] = [];

    for (const convertedRow of convertedRows) {
      assertTaskFieldMatches(convertedRow, taskType);
      rows.push(await this.generateRow(convertedRow, taskType, modelId));
    }

    const { syntheticDatasetArtifactKey } =
      await this.syntheticDatasetWriter.writeSyntheticDataset(datasetId, rows);

    return {
      syntheticDatasetArtifactKey,
      generatedCount: countRowsByStatus(rows, 'completed'),
      failedCount: countRowsByStatus(rows, 'failed'),
    };
  }

  private async generateRow(
    convertedRow: ConvertedDatasetRow,
    taskType: PreprocessingTaskType,
    modelId: string | undefined,
  ): Promise<SyntheticOutputRow> {
    try {
      const prompt = this.promptBuilder.buildPrompt({
        row: convertedRow,
        taskType,
      });
      const result = await this.modelClient.generate({ prompt, modelId });
      const normalizedOutput = this.promptBuilder.normalizeOutput({
        rawOutput: result.output,
        taskType,
      });

      return {
        ...convertedRow,
        ...buildGeneratedField(taskType, normalizedOutput),
        status: 'completed',
        model_id: result.modelId,
      };
    } catch (error: unknown) {
      return {
        ...convertedRow,
        ...buildGeneratedField(taskType, ''),
        status: 'failed',
        error_message:
          error instanceof Error ? error.message : 'Unknown generation error',
      };
    }
  }
}

export const tokenGenerateSyntheticOutputsUseCase =
  createInjectionToken<GenerateSyntheticOutputsUseCase>(
    'GenerateSyntheticOutputsUseCase',
    {
      useClass: GenerateSyntheticOutputsUseCaseImpl,
    },
  );

function assertTaskFieldMatches(
  row: ConvertedDatasetRow,
  taskType: PreprocessingTaskType,
): void {
  if (taskType === 'summarization' && row.summary === undefined) {
    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'CONVERTED_DATASET_TASK_FIELD_MISMATCH',
      'Summarization converted rows must include a summary field',
    );
  }

  if (taskType === 'classification' && row.class === undefined) {
    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'CONVERTED_DATASET_TASK_FIELD_MISMATCH',
      'Classification converted rows must include a class field',
    );
  }
}

function buildGeneratedField(
  taskType: PreprocessingTaskType,
  output: string,
): Pick<SyntheticOutputRow, 'summary' | 'class'> {
  return taskType === 'summarization' ? { summary: output } : { class: output };
}

function countRowsByStatus(
  rows: SyntheticOutputRow[],
  status: SyntheticOutputRow['status'],
): number {
  return rows.filter((row) => row.status === status).length;
}
