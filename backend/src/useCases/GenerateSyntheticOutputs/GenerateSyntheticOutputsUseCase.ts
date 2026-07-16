import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import {
  ConvertedDatasetRow,
  SyntheticOutputRow,
  SyntheticOutputTaskType,
} from '../../models/SyntheticOutput';
import { tokenSyntheticOutputModelClient } from '../../ports/SyntheticOutputModelClient';
import { tokenSyntheticOutputPromptBuilder } from '../../ports/SyntheticOutputPromptBuilder';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';

export interface GenerateSyntheticOutputsInput {
  datasetId: string;
  convertedDatasetArtifactKey: string;
  taskType: SyntheticOutputTaskType;
  modelId?: string;
}

export interface RetryFailedRowsInput {
  datasetId: string;
  syntheticDatasetArtifactKey: string;
  convertedDatasetArtifactKey: string;
  taskType: SyntheticOutputTaskType;
  modelId?: string;
}

export interface GenerateSyntheticOutputsOutput {
  syntheticDatasetArtifactKey: string;
  generatedCount: number;
  failedCount: number;
}

export type GenerateSyntheticOutputsUseCase = {
  generateSyntheticOutputs(
    input: GenerateSyntheticOutputsInput,
  ): Promise<GenerateSyntheticOutputsOutput>;

  retryFailedRows(
    input: RetryFailedRowsInput,
  ): Promise<GenerateSyntheticOutputsOutput>;
};

export class GenerateSyntheticOutputsUseCaseImpl implements GenerateSyntheticOutputsUseCase {
  private readonly datasetService = inject(tokenDatasetService);
  private readonly promptBuilder = inject(tokenSyntheticOutputPromptBuilder);
  private readonly modelClient = inject(tokenSyntheticOutputModelClient);

  async generateSyntheticOutputs({
    datasetId,
    convertedDatasetArtifactKey,
    taskType,
    modelId,
  }: GenerateSyntheticOutputsInput): Promise<GenerateSyntheticOutputsOutput> {
    const convertedRows = await this.datasetService.readConvertedDatasetRows(
      convertedDatasetArtifactKey,
    );

    const rows: SyntheticOutputRow[] = [];

    for (const convertedRow of convertedRows) {
      assertTaskFieldMatches(convertedRow, taskType);
      rows.push(await this.generateRow(convertedRow, taskType, modelId));
    }

    const { syntheticDatasetArtifactKey } =
      await this.datasetService.writeSyntheticDataset(datasetId, rows);

    return {
      syntheticDatasetArtifactKey,
      generatedCount: countRowsByStatus(rows, 'completed'),
      failedCount: countRowsByStatus(rows, 'failed'),
    };
  }

  async retryFailedRows({
    datasetId,
    syntheticDatasetArtifactKey,
    convertedDatasetArtifactKey,
    taskType,
    modelId,
  }: RetryFailedRowsInput): Promise<GenerateSyntheticOutputsOutput> {
    const existingRows = await this.datasetService.readSyntheticDatasetRows(
      syntheticDatasetArtifactKey,
    );
    const convertedRows = await this.datasetService.readConvertedDatasetRows(
      convertedDatasetArtifactKey,
    );
    const convertedByChunkId = new Map(
      convertedRows.map((row) => [row.chunk_id, row]),
    );

    const updatedRows: SyntheticOutputRow[] = [];

    for (const row of existingRows) {
      if (row.status !== 'failed') {
        updatedRows.push(row);
        continue;
      }

      const convertedRow = convertedByChunkId.get(row.chunk_id);
      if (!convertedRow) {
        updatedRows.push(row);
        continue;
      }

      updatedRows.push(await this.generateRow(convertedRow, taskType, modelId));
    }

    const { syntheticDatasetArtifactKey: updatedKey } =
      await this.datasetService.writeSyntheticDataset(datasetId, updatedRows);

    return {
      syntheticDatasetArtifactKey: updatedKey,
      generatedCount: countRowsByStatus(updatedRows, 'completed'),
      failedCount: countRowsByStatus(updatedRows, 'failed'),
    };
  }

  private async generateRow(
    convertedRow: ConvertedDatasetRow,
    taskType: SyntheticOutputTaskType,
    modelId: string | undefined,
  ): Promise<SyntheticOutputRow> {
    try {
      const prompt = this.promptBuilder.buildPrompt({
        document: convertedRow.document,
        taskType,
      });
      const result = await this.modelClient.generate({ prompt, modelId });
      const normalizedOutput = this.promptBuilder.normalizeOutput({
        rawOutput: result.output,
        taskType,
      });

      return {
        chunk_id: convertedRow.chunk_id,
        document_id: convertedRow.document_id,
        text: convertedRow.document,
        ...buildGeneratedField(taskType, normalizedOutput),
        status: 'completed',
        model_id: result.modelId,
      };
    } catch (error: unknown) {
      return {
        chunk_id: convertedRow.chunk_id,
        document_id: convertedRow.document_id,
        text: convertedRow.document,
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
  taskType: SyntheticOutputTaskType,
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
  taskType: SyntheticOutputTaskType,
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
