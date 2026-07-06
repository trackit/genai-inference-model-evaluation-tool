import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import {
  ChunkingStrategy,
  DocumentChunk,
  DocumentConversionRequest,
  DocumentConversionResult,
  ExtractedDocument,
} from '../../models/DocumentConversion';
import { tokenDocumentConversionService } from '../../services/DocumentConversionService/DocumentConversionServiceS3';

export type DocumentConversionUseCase = {
  execute(request: DocumentConversionRequest): Promise<DocumentConversionResult>;
};

export function chunkDocuments(
  extracted: ExtractedDocument[],
  strategy: ChunkingStrategy,
): DocumentChunk[] {
  return extracted.flatMap((document) => {
    if (strategy === ChunkingStrategy.DOCUMENT) {
      return [
        {
          documentId: document.documentId,
          chunkId: `${document.documentId}-0`,
          text: document.text.trim(),
        },
      ];
    }

    return chunkDocumentByChapter(document);
  });
}

export function buildConversionJsonl(chunks: DocumentChunk[]): string {
  return chunks
    .map((chunk) =>
      JSON.stringify({
        document_id: chunk.documentId,
        chunk_id: chunk.chunkId,
        text: chunk.text,
      }),
    )
    .join('\n');
}

function chunkDocumentByChapter(document: ExtractedDocument): DocumentChunk[] {
  const normalizedText = document.text.replace(/\r\n/g, '\n').trim();
  const potentialChapters = normalizedText
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (potentialChapters.length === 0) {
    return [
      {
        documentId: document.documentId,
        chunkId: `${document.documentId}-0`,
        text: normalizedText,
      },
    ];
  }

  return potentialChapters.map((text, index) => ({
    documentId: document.documentId,
    chunkId: `${document.documentId}-${index}`,
    text,
  }));
}

export class DocumentConversionUseCaseImpl implements DocumentConversionUseCase {
  private readonly documentConversionService = inject(
    tokenDocumentConversionService,
  );

  async execute(
    request: DocumentConversionRequest,
  ): Promise<DocumentConversionResult> {
    this.validateRequest(request);
    // TODO: Extract fileType from the upload manifest instead of hardcoding it to 'pdf'

    const extracted = await this.fetchAndParseAll(request);
    const chunks = chunkDocuments(extracted, request.chunkingStrategy);
    const jsonl = buildConversionJsonl(chunks);

    return {
      uncompleteDatasetFile: '',
      S3key: '',
      jsonl,
    };
  }

  private async fetchAndParseAll(
    request: DocumentConversionRequest,
  ): Promise<ExtractedDocument[]> {
    return Promise.all(
      request.documents.map((documentId) =>
        this.documentConversionService.fetchAndParse(
          request.datasetId,
          documentId,
          // fileType will come from the upload manifest
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
