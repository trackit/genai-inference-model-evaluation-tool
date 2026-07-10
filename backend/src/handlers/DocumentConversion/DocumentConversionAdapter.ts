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
  document_id: z.string({
    error: 'document_id is required',
  }),
  file_type: z.enum(SUPPORTED_DOCUMENT_FILE_TYPES, {
    error: `file_type must be one of: ${SUPPORTED_DOCUMENT_FILE_TYPES.join(', ')}`,
  }),
});

const documentConversionBodySchema = z.object({
  dataset_id: z.string({
    error: 'dataset_id is required',
  }),
  documents: z
    .array(documentEntrySchema, {
      error:
        'documents must be a non-empty array of objects with document_id and file_type',
    })
    .min(
      1,
      'documents must be a non-empty array of objects with document_id and file_type',
    ),
  task_type: z.enum(TaskType, {
    error: `task_type must be one of: ${Object.values(TaskType).join(', ')}`,
  }),
  chunking_strategy: z
    .enum(ChunkingStrategy)
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
    const request = this.parseRequest(event);
    const result = await this.useCase.execute(request);

    return result;
  }

  private parseRequest(
    event: APIGatewayProxyEventV2,
  ): DocumentConversionRequest {
    const { body } = parseApiEvent(event, {
      bodySchema: documentConversionBodySchema,
    });

    return body;
  }
}
