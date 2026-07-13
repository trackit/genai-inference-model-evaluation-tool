import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z } from 'zod';

import {
  ChunkingStrategy,
  SUPPORTED_DOCUMENT_FILE_TYPES,
  TaskType,
} from '../../models/DocumentConversion';
import {
  DocumentConversionRequest,
  tokenDocumentConversionUseCase,
} from '../../useCases/DocumentConversion/DocumentConversionUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';
import { parseApiEvent } from '../api/parseApiEvent';

const documentEntrySchema = z.object({
  document_id: z.uuid({
    error: 'document_id must be a valid UUID',
  }),
  file_type: z.enum(SUPPORTED_DOCUMENT_FILE_TYPES, {
    error: `file_type must be one of: ${SUPPORTED_DOCUMENT_FILE_TYPES.join(', ')}`,
  }),
});

const documentConversionBodySchema = z.object({
  dataset_id: z.uuid({ error: 'dataset_id must be a valid UUID' }),
  documents: z
    .array(documentEntrySchema, {
      error: 'documents must be an array',
    })
    .min(1, 'documents must contain at least one document'),
  task_type: z.enum(TaskType, {
    error: `task_type must be one of: ${Object.values(TaskType).join(', ')}`,
  }),
  chunking_strategy: z
    .enum(ChunkingStrategy, {
      error: `chunking_strategy must be one of: ${Object.values(ChunkingStrategy).join(', ')}`,
    })
    .optional()
    .default(ChunkingStrategy.CHAPTER),
});

export class DocumentConversionAdapter {
  private readonly useCase = inject(tokenDocumentConversionUseCase);

  public async handle(
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyResultV2> {
    return handleHttpRequest({
      event,
      func: this.processRequest.bind(this),
    });
  }

  private async processRequest(event: APIGatewayProxyEventV2) {
    const { body } = parseApiEvent(event, {
      bodySchema: documentConversionBodySchema,
    });

    return this.useCase.execute(body as DocumentConversionRequest);
  }
}
