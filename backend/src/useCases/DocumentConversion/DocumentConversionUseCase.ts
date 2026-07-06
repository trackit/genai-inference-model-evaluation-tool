import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import {
  ChunkingStrategy,
  DocumentConversionRequest,
  DocumentConversionResult,
} from '../../models/DocumentConversion';
import { tokenDocumentConversionService } from '../../services/DocumentConversionService/DocumentConversionServiceS3';

export type DocumentConversionUseCase = {
  execute(request: DocumentConversionRequest): Promise<DocumentConversionResult>;
};

export class DocumentConversionUseCaseImpl implements DocumentConversionUseCase {
  private readonly documentConversionService = inject(
    tokenDocumentConversionService,
  );

  async execute(
    request: DocumentConversionRequest,
  ): Promise<DocumentConversionResult> {
    this.validateRequest(request);

    await this.fetchAllDocuments(request);

    // Text extraction, chunking, JSONL generation, and S3 storage
    // will be implemented in the next task.
    throw new Error('Not implemented');
  }

  private async fetchAllDocuments(request: DocumentConversionRequest) {
    return Promise.all(
      request.documents.map((documentId) =>
        this.documentConversionService.fetchDocument(
          request.datasetId,
          documentId,
          // fileType will come from the upload manifest (next task)
          'pdf',
        ),
      ),
    );
  }

  private validateRequest(request: DocumentConversionRequest): void {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(request.datasetId)) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_DATASET_ID',
        'datasetId must be a valid UUID',
      );
    }

    if (!Array.isArray(request.documents) || request.documents.length === 0) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_DOCUMENTS',
        'documents must be a non-empty array of document UUIDs',
      );
    }

    for (const id of request.documents) {
      if (!uuidPattern.test(id)) {
        throw new BasicError(
          BasicErrorType.BAD_REQUEST,
          'INVALID_DOCUMENT_ID',
          `"${id}" is not a valid document UUID`,
        );
      }
    }

    if (!Object.values(ChunkingStrategy).includes(request.chunkingStrategy)) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_CHUNKING_STRATEGY',
        `chunkingStrategy must be one of: ${Object.values(ChunkingStrategy).join(', ')}`,
      );
    }
  }
}

export const tokenDocumentConversionUseCase =
  createInjectionToken<DocumentConversionUseCase>('DocumentConversionUseCase', {
    useClass: DocumentConversionUseCaseImpl,
  });
