import { createInjectionToken, inject } from '@trackit.io/di-container';

import { tokenDatasetService } from 'backend/src/services/DatasetService/DatasetServiceS3';
import { BasicError, BasicErrorType } from '../../errors';
import {
  ChunkingStrategy,
  DocumentChunk,
  DocumentRequestEntry,
  ExtractedDocument,
  TaskType,
} from '../../models/DocumentConversion';
import { tokenDocumentConversionService } from '../../services/DocumentConversionService/DocumentConversionServiceS3';
import { chunkDocumentByChapter } from '../../utils/chapterChunking';

export type DocumentConversionUseCase = {
  execute(request: DocumentConversionRequest): Promise<string>;
};

export interface DocumentConversionRequest {
  dataset_id: string;
  documents: DocumentRequestEntry[];
  chunking_strategy: ChunkingStrategy;
  task_type: TaskType;
}

export function chunkDocuments(
  extracted: ExtractedDocument[],
  strategy: ChunkingStrategy,
): DocumentChunk[] {
  return extracted.flatMap((document) => {
    if (strategy === ChunkingStrategy.DOCUMENT) {
      return [
        {
          document_id: document.document_id,
          chunk_id: `${document.document_id}-0`,
          text: document.text.trim(),
        },
      ];
    }

    return chunkDocumentByChapter(document);
  });
}

export function buildConversionJsonl(
  chunks: DocumentChunk[],
  taskType: TaskType,
): string {
  return chunks
    .map((chunk) => {
      const record: Record<string, string> = {
        document_id: chunk.document_id,
        chunk_id: chunk.chunk_id,
        document: chunk.text,
      };

      if (taskType === TaskType.SUMMARIZATION) {
        record.summary = '';
      }

      if (taskType === TaskType.CLASSIFICATION) {
        record.class = '';
      }

      return JSON.stringify(record);
    })
    .join('\n');
}

export class DocumentConversionUseCaseImpl implements DocumentConversionUseCase {
  private readonly documentConversionService = inject(
    tokenDocumentConversionService,
  );
  private readonly datasetService = inject(tokenDatasetService);

  async execute(request: DocumentConversionRequest): Promise<string> {
    const extracted = await this.fetchAndParseAll(request);
    const chunks = chunkDocuments(extracted, request.chunking_strategy);
    const jsonl = buildConversionJsonl(chunks, request.task_type);

    const convertedDatasetFileKey: string = `datasets/${request.dataset_id}/${request.dataset_id}-converted.jsonl`;

    const storedJsonlKey: string =
      await this.datasetService.storeConversionJsonl(
        convertedDatasetFileKey,
        jsonl,
      );

    return storedJsonlKey;
  }

  private async fetchAndParseAll(
    request: DocumentConversionRequest,
  ): Promise<ExtractedDocument[]> {
    return Promise.all(
      request.documents.map(async ({ document_id, file_type }) => {
        const documentKey = `datasets/${request.dataset_id}/${document_id}.${file_type}`;

        const rawContent =
          await this.datasetService.fetchRawContent(documentKey);

        const extractedText = await this.documentConversionService.parse(
          rawContent,
          file_type,
        );

        const extracted: ExtractedDocument = {
          document_id,
          text: extractedText,
        };

        if (!extracted.text) {
          throw new BasicError(
            BasicErrorType.BAD_REQUEST,
            'EMPTY_DOCUMENT_TEXT',
            `Document "${document_id}" could not be converted into readable text`,
          );
        }

        return extracted;
      }),
    );
  }
}

export const tokenDocumentConversionUseCase =
  createInjectionToken<DocumentConversionUseCase>('DocumentConversionUseCase', {
    useClass: DocumentConversionUseCaseImpl,
  });
