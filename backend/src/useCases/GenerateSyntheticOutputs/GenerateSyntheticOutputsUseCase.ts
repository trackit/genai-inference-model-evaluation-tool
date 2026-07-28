import { createInjectionToken, inject } from '@trackit.io/di-container';

import {
  ConvertedDatasetRow,
  SyntheticOutputRow,
  SyntheticOutputTaskType,
} from '../../models/SyntheticOutput';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';
import { classifyModelError } from '../../services/SyntheticOutputModelClient/classifyModelError';
import { tokenSyntheticOutputModelClient } from '../../services/SyntheticOutputModelClient/BedrockSyntheticOutputModelClient';
import { tokenSyntheticOutputPromptBuilder } from '../../services/SyntheticOutputPromptBuilder/SyntheticOutputPromptBuilder';

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

    // Transitional NOTE: generateRow now throws instead of returning a 'failed' row, and
    // this loop has no try/catch of its own. This means the whole call now
    // REJECTS on the first failing row, and no dataset artifact is written.
    for (const convertedRow of convertedRows) {
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

      // Transitional NOTE: Same caveat as generateSyntheticOutputs above: this now rejects on
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

  /**
   * Generates a single row. Throws a classified TransientModelError or
   * PermanentModelError on any failure (model call, prompt building, or
   * output normalization)
   *
   * Transitional NOTE: No longer continue past a failing row 
   * and return generatedCount/failedCount; they now reject on the first failure.
   */
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
      throw classifyModelError(error);
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
