import { createInjectionToken, inject } from '@trackit.io/di-container';

import {
  ConvertedDatasetRow,
  SyntheticOutputRow,
  SyntheticOutputTaskType,
} from '../../models/SyntheticOutput';
import { tokenSyntheticOutputModelClient } from '../../services/SyntheticOutputModelClient/BedrockSyntheticOutputModelClient';
import {
  classifyModelError,
  PermanentModelError,
} from '../../services/SyntheticOutputModelClient/classifyModelError';
import { tokenSyntheticOutputPromptBuilder } from '../../services/SyntheticOutputPromptBuilder/SyntheticOutputPromptBuilder';

export interface GenerateSyntheticOutputRowInput {
  convertedRow: ConvertedDatasetRow;
  taskType: SyntheticOutputTaskType;
  modelId?: string;
}

export type GenerateSyntheticOutputRowUseCase = {
  /**
   * Generates a single row: builds the prompt, calls the model, normalizes
   * the output.
   *
   * - On a TransientModelError, throws it - the Step Functions Distributed
   *   Map's per-row Retry (backoff + jitter) needs to see this as a real
   *   failure to retry the iteration.
   * - On a PermanentModelError, does NOT throw - returns a normal
   *   `status: 'failed'` row instead. This lets the row complete its Map
   *   iteration successfully (from Step Functions' point of view), which is
   *   what enables partial success.
   */
  execute(input: GenerateSyntheticOutputRowInput): Promise<SyntheticOutputRow>;
};

export class GenerateSyntheticOutputRowUseCaseImpl implements GenerateSyntheticOutputRowUseCase {
  private readonly promptBuilder = inject(tokenSyntheticOutputPromptBuilder);
  private readonly modelClient = inject(tokenSyntheticOutputModelClient);

  async execute({
    convertedRow,
    taskType,
    modelId,
  }: GenerateSyntheticOutputRowInput): Promise<SyntheticOutputRow> {
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
      const classifiedError = classifyModelError(error);

      if (classifiedError instanceof PermanentModelError) {
        return {
          chunk_id: convertedRow.chunk_id,
          document_id: convertedRow.document_id,
          text: convertedRow.document,
          status: 'failed',
          error_message:
            classifiedError.cause instanceof Error
              ? classifiedError.cause.message
              : classifiedError.message,
        };
      }

      throw classifiedError;
    }
  }
}

export const tokenGenerateSyntheticOutputRowUseCase =
  createInjectionToken<GenerateSyntheticOutputRowUseCase>(
    'GenerateSyntheticOutputRowUseCase',
    {
      useClass: GenerateSyntheticOutputRowUseCaseImpl,
    },
  );

function buildGeneratedField(
  taskType: SyntheticOutputTaskType,
  output: string,
): Pick<SyntheticOutputRow, 'summary' | 'class'> {
  return taskType === 'summarization' ? { summary: output } : { class: output };
}
