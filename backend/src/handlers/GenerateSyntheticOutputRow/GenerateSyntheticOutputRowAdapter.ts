import { inject } from '@trackit.io/di-container';
import { z } from 'zod';

import { SYNTHETIC_OUTPUT_TASK_TYPES } from '../../models/SyntheticOutput';
import { classifyModelError } from '../../services/SyntheticOutputModelClient/classifyModelError';
import { tokenGenerateSyntheticOutputRowUseCase } from '../../useCases/GenerateSyntheticOutputRow/GenerateSyntheticOutputRowUseCase';

const generateSyntheticOutputRowEventSchema = z.object({
  chunk_id: z.string().min(1, 'chunk_id is required'),
  document_id: z.uuid({ error: 'document_id must be a valid UUID' }),
  document: z.string().min(1, 'document is required'),
  taskType: z.enum(SYNTHETIC_OUTPUT_TASK_TYPES, {
    error: `taskType must be one of: ${SYNTHETIC_OUTPUT_TASK_TYPES.join(', ')}`,
  }),
  modelId: z.string().optional(),
});

export class GenerateSyntheticOutputRowAdapter {
  private readonly useCase = inject(tokenGenerateSyntheticOutputRowUseCase);

  public async handle(event: unknown) {
    try {
      const input = generateSyntheticOutputRowEventSchema.parse(event);

      return await this.useCase.execute({
        convertedRow: {
          chunk_id: input.chunk_id,
          document_id: input.document_id,
          document: input.document,
        },
        taskType: input.taskType,
        modelId: input.modelId,
      });
    } catch (error: unknown) {
      throw classifyModelError(error);
    }
  }
}
