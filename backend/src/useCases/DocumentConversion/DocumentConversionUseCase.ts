import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import {
    ChunkingStrategy,
    DocumentChunk,
    DocumentConversionRequest,
    DocumentConversionResult,
    ExtractedDocument,
    isSupportedDocumentFileType,
    SUPPORTED_DOCUMENT_FILE_TYPES,
    TaskType,
} from '../../models/DocumentConversion';
import { tokenDocumentConversionService } from '../../services/DocumentConversionService/DocumentConversionServiceS3';
import { chunkDocumentByChapter } from './chapterChunking';

export type DocumentConversionUseCase = {
    execute(request: DocumentConversionRequest): Promise<DocumentConversionResult>;
};

export function chunkDocuments(
    extracted: ExtractedDocument[],
    strategy: ChunkingStrategy): DocumentChunk[] {
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
    private readonly documentConversionService = inject(tokenDocumentConversionService);

    async execute(request: DocumentConversionRequest): Promise<DocumentConversionResult> {
        this.validateRequest(request);

        const extracted = await this.fetchAndParseAll(request);
        const chunks = chunkDocuments(extracted, request.chunking_strategy);
        const jsonl = buildConversionJsonl(chunks, request.task_type);

        const storedJsonlKey: DocumentConversionResult =
            await this.documentConversionService.storeConversionJsonl(
                request.dataset_id,
                jsonl,
            );

        return storedJsonlKey;
    }

    private async fetchAndParseAll(
        request: DocumentConversionRequest,
    ): Promise<ExtractedDocument[]> {
        return Promise.all(
            request.documents.map(async ({ document_id, file_type }) => {
                const extracted = await this.documentConversionService.fetchAndParse(
                    request.dataset_id,
                    document_id,
                    file_type,
                );

                if (!extracted.text.trim()) {
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

    private validateRequest(request: DocumentConversionRequest): void {
        const uuidPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidPattern.test(request.dataset_id)) {
            throw new BasicError(
                BasicErrorType.BAD_REQUEST,
                'INVALID_DATASET_ID',
                'dataset_id must be a valid UUID',
            );
        }

        if (!Array.isArray(request.documents) || request.documents.length === 0) {
            throw new BasicError(
                BasicErrorType.BAD_REQUEST,
                'INVALID_DOCUMENTS',
                'documents must be a non-empty array of document entries with document_id and file_type',
            );
        }

        for (const entry of request.documents) {
            const id = entry.document_id;
            if (!uuidPattern.test(id)) {
                throw new BasicError(
                    BasicErrorType.BAD_REQUEST,
                    'INVALID_DOCUMENT_ID',
                    `"${id}" is not a valid document UUID`,
                );
            }

            if (!isSupportedDocumentFileType(entry.file_type)) {
                throw new BasicError(
                    BasicErrorType.BAD_REQUEST,
                    'INVALID_FILE_TYPE',
                    `file_type must be one of: ${SUPPORTED_DOCUMENT_FILE_TYPES.join(', ')}`,
                );
            }
        }

        if (!Object.values(ChunkingStrategy).includes(request.chunking_strategy)) {
            throw new BasicError(
                BasicErrorType.BAD_REQUEST,
                'INVALID_CHUNKING_STRATEGY',
                `chunking_strategy must be one of: ${Object.values(ChunkingStrategy).join(', ')}`,
            );
        }

        if (!Object.values(TaskType).includes(request.task_type)) {
            throw new BasicError(
                BasicErrorType.BAD_REQUEST,
                'INVALID_TASK_TYPE',
                `task_type must be one of: ${Object.values(TaskType).join(', ')}`,
            );
        }
    }
}

export const tokenDocumentConversionUseCase =
    createInjectionToken<DocumentConversionUseCase>('DocumentConversionUseCase', {
        useClass: DocumentConversionUseCaseImpl,
    });
