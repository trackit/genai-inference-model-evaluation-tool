import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { DocumentChunk } from '../../models/Preprocessing';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';

export interface PreprocessingChunkReader {
  readChunks(chunkArtifactKey: string): Promise<DocumentChunk[]>;
}

export class PreprocessingChunkReaderS3 implements PreprocessingChunkReader {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenClientS3);

  async readChunks(chunkArtifactKey: string): Promise<DocumentChunk[]> {
    if (!chunkArtifactKey.trim()) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'CHUNK_ARTIFACT_KEY_REQUIRED',
        'Chunk artifact key is required',
      );
    }

    const content = await this.retrieveArtifact(chunkArtifactKey);
    return parseChunkArtifact(content);
  }

  private async retrieveArtifact(chunkArtifactKey: string): Promise<string> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: chunkArtifactKey,
        }),
      );

      return response.Body!.transformToString();
    } catch (error: unknown) {
      if (isS3NotFound(error)) {
        throw new BasicError(
          BasicErrorType.NOT_FOUND,
          'CHUNK_ARTIFACT_NOT_FOUND',
          'Chunk artifact not found',
          `No chunk artifact found at key: ${chunkArtifactKey}`,
        );
      }

      throw error;
    }
  }
}

export const tokenPreprocessingChunkReader =
  createInjectionToken<PreprocessingChunkReader>('PreprocessingChunkReader', {
    useClass: PreprocessingChunkReaderS3,
  });

function parseChunkArtifact(content: string): DocumentChunk[] {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'EMPTY_CHUNK_ARTIFACT',
      'Chunk artifact must contain at least one chunk',
    );
  }

  return lines.map((line, index) => parseChunkLine(line, index + 1));
}

function parseChunkLine(line: string, lineNumber: number): DocumentChunk {
  try {
    const value = JSON.parse(line) as unknown;
    return validateDocumentChunk(value, lineNumber);
  } catch (error: unknown) {
    if (error instanceof BasicError) throw error;
    if (error instanceof SyntaxError) {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'INVALID_CHUNK_ARTIFACT_FORMAT',
        `Error parsing chunk artifact line ${lineNumber}: Invalid JSON`,
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown parsing error';
    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'INVALID_CHUNK_ARTIFACT_FORMAT',
      `Error parsing chunk artifact line ${lineNumber}: ${errorMessage}`,
    );
  }
}

function validateDocumentChunk(
  value: unknown,
  lineNumber: number,
): DocumentChunk {
  if (!isRecord(value)) {
    throw invalidChunk(lineNumber, 'line must be a JSON object');
  }

  const chunk = {
    chunk_id: readRequiredString(value, 'chunk_id', lineNumber),
    document_id: readRequiredString(value, 'document_id', lineNumber),
    source_filename: readRequiredString(value, 'source_filename', lineNumber),
    chunk_index: readChunkIndex(value, lineNumber),
    text: readRequiredString(value, 'text', lineNumber),
  } satisfies DocumentChunk;

  if (value.metadata !== undefined) {
    return {
      ...chunk,
      metadata: readMetadata(value.metadata, lineNumber),
    };
  }

  return chunk;
}

function readRequiredString(
  value: Record<string, unknown>,
  field: keyof DocumentChunk,
  lineNumber: number,
): string {
  const fieldValue = value[field];
  if (typeof fieldValue !== 'string' || fieldValue.trim().length === 0) {
    throw invalidChunk(lineNumber, `"${field}" must be a non-empty string`);
  }

  return fieldValue;
}

function readChunkIndex(
  value: Record<string, unknown>,
  lineNumber: number,
): number {
  const fieldValue = value.chunk_index;
  if (
    typeof fieldValue !== 'number' ||
    !Number.isInteger(fieldValue) ||
    fieldValue < 0
  ) {
    throw invalidChunk(
      lineNumber,
      '"chunk_index" must be a non-negative integer',
    );
  }

  return fieldValue;
}

function readMetadata(
  value: unknown,
  lineNumber: number,
): DocumentChunk['metadata'] {
  if (!isRecord(value)) {
    throw invalidChunk(
      lineNumber,
      '"metadata" must be an object when provided',
    );
  }

  const metadata: DocumentChunk['metadata'] = {};

  if (value.section_title !== undefined) {
    if (typeof value.section_title !== 'string') {
      throw invalidChunk(
        lineNumber,
        '"metadata.section_title" must be a string',
      );
    }
    metadata.section_title = value.section_title;
  }

  if (value.page_start !== undefined) {
    metadata.page_start = readMetadataInteger(
      value.page_start,
      'page_start',
      lineNumber,
    );
  }

  if (value.page_end !== undefined) {
    metadata.page_end = readMetadataInteger(
      value.page_end,
      'page_end',
      lineNumber,
    );
  }

  return metadata;
}

function readMetadataInteger(
  value: unknown,
  field: 'page_start' | 'page_end',
  lineNumber: number,
): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw invalidChunk(
      lineNumber,
      `"metadata.${field}" must be a positive integer`,
    );
  }

  return value;
}

function invalidChunk(lineNumber: number, reason: string): BasicError {
  return new BasicError(
    BasicErrorType.UNPROCESSABLE_ENTITY,
    'INVALID_CHUNK_ARTIFACT_FORMAT',
    `Invalid chunk artifact line ${lineNumber}: ${reason}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isS3NotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'NoSuchKey' || error.name === 'NotFound')
  );
}
