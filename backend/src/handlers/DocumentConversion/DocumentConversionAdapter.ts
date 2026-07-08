import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { BasicError, BasicErrorType } from '../../errors';
import {
  ChunkingStrategy,
  DocumentConversionRequest,
  TaskType,
  DocumentRequestEntry,
  isSupportedDocumentFileType,
  SUPPORTED_DOCUMENT_FILE_TYPES,
} from '../../models/DocumentConversion';
import { tokenDocumentConversionUseCase } from '../../useCases/DocumentConversion/DocumentConversionUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';

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

  private parseRequest(event: APIGatewayProxyEventV2): DocumentConversionRequest {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event.body;

    if (!rawBody) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'MISSING_BODY',
        'Request body is required',
      );
    }

    let payload: DocumentConversionRequest;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_BODY',
        'Request body must be valid JSON',
      );
    }

    if (!payload.dataset_id) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'MISSING_DATASET_ID',
        'dataset_id is required',
      );
    }

    if (!Array.isArray(payload.documents) || payload.documents.length === 0) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_DOCUMENTS',
        'documents must be a non-empty array of objects with document_id and file_type',
      );
    }

    if (!payload.task_type || !Object.values(TaskType).includes(payload.task_type)) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_TASK_TYPE',
        `task_type must be one of: ${Object.values(TaskType).join(', ')}`,
      );
    }

    const normalizedDocs: DocumentRequestEntry[] = (payload.documents).map(
      (documentEntry: DocumentRequestEntry) => {
        if (!documentEntry || typeof documentEntry !== 'object' || Array.isArray(documentEntry)) {
          throw new BasicError(
            BasicErrorType.BAD_REQUEST,
            'INVALID_DOCUMENTS',
            'documents must be objects with document_id and file_type'
          );
        }

        if (
          !documentEntry.file_type ||
          !isSupportedDocumentFileType(documentEntry.file_type)
        ) {
          throw new BasicError(
            BasicErrorType.BAD_REQUEST,
            'INVALID_FILE_TYPE',
            `file_type must be one of: ${SUPPORTED_DOCUMENT_FILE_TYPES.join(', ')}`,
          );
        }

        return documentEntry;
      },
    );

    const chunkingStrategyToUse = payload.chunking_strategy ?? ChunkingStrategy.CHAPTER;

    return {
      dataset_id: payload.dataset_id,
      documents: normalizedDocs,
      chunking_strategy: chunkingStrategyToUse,
      task_type: payload.task_type,
    };
  }
}
