import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { DatasetFileType } from '../../models/Dataset';
import {
  ChunkingStrategy,
  DocumentChunk,
  ExtractedDocument,
  SUPPORTED_DOCUMENT_FILE_TYPES,
  SupportedDocumentFileType,
} from '../../models/DocumentConversion';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';
import { tokenDocumentConversionService } from '../../services/DocumentConversionService/DocumentConversionServiceS3';
import { chunkDocumentBySection } from '../../utils/chapterChunking';

export type DocumentConversionUseCase = {
  execute(request: DocumentConversionRequest): Promise<string>;
};

export type DocumentRequestEntry = {
  document_id: string;
  file_type: DatasetFileType;
};

export interface DocumentConversionRequest {
  dataset_id: string;
  chunking_strategy: ChunkingStrategy;
}

function isSupportedDocumentType(
  fileType: DatasetFileType,
): fileType is SupportedDocumentFileType {
  return (SUPPORTED_DOCUMENT_FILE_TYPES as readonly string[]).includes(
    fileType,
  );
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

    return chunkDocumentBySection(document);
  });
}

export function buildConversionJsonl(chunks: DocumentChunk[]): string {
  return chunks
    .map((chunk) => {
      const record: Record<string, string> = {
        document_id: chunk.document_id,
        chunk_id: chunk.chunk_id,
        document: chunk.text,
      };

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
    const documents = await this.resolveDocuments(request.dataset_id);
    const extracted = await this.fetchAndParseAll(
      request.dataset_id,
      documents,
    );

    const chunks = chunkDocuments(extracted, request.chunking_strategy);

    const jsonl = buildConversionJsonl(chunks);

    const storedJsonlKey: string =
      await this.datasetService.storeConversionJsonl(request.dataset_id, jsonl);

    return storedJsonlKey;
  }

  /**
   * Resolves which uploaded documents to convert from the dataset's upload
   * manifest (the state machine only carries a datasetId, not the file list).
   */
  private async resolveDocuments(
    datasetId: string,
  ): Promise<DocumentRequestEntry[]> {
    const manifest = await this.datasetService.readUploadManifest(datasetId);
    if (!manifest) {
      throw new BasicError(
        BasicErrorType.NOT_FOUND,
        'UPLOAD_MANIFEST_NOT_FOUND',
        'Upload manifest not found',
        `No manifest found for dataset ${datasetId}`,
      );
    }

    const documents = manifest.files
      .filter((file) => isSupportedDocumentType(file.file_type))
      .map((file) => ({
        document_id: file.document_id,
        file_type: file.file_type,
      }));

    if (documents.length === 0) {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'NO_DOCUMENTS_TO_CONVERT',
        'No pdf/doc/docx documents found for this dataset',
      );
    }

    return documents;
  }

  private async fetchAndParseAll(
    datasetId: string,
    documents: DocumentRequestEntry[],
  ): Promise<ExtractedDocument[]> {
    return Promise.all(
      documents.map(async ({ document_id, file_type }) => {
        const rawContent = await this.datasetService.fetchRawContent(
          datasetId,
          document_id,
          file_type,
        );

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
