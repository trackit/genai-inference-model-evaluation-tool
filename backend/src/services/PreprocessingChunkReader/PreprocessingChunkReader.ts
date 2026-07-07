import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { ConvertedDatasetRow } from '../../models/Preprocessing';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';

export interface PreprocessingChunkReader {
  readConvertedRows(
    convertedDatasetArtifactKey: string,
  ): Promise<ConvertedDatasetRow[]>;
}

export class PreprocessingChunkReaderS3 implements PreprocessingChunkReader {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenClientS3);

  async readConvertedRows(
    convertedDatasetArtifactKey: string,
  ): Promise<ConvertedDatasetRow[]> {
    if (!convertedDatasetArtifactKey.trim()) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'CONVERTED_DATASET_ARTIFACT_KEY_REQUIRED',
        'Converted dataset artifact key is required',
      );
    }

    const content = await this.retrieveArtifact(convertedDatasetArtifactKey);
    return parseConvertedDatasetArtifact(content);
  }

  private async retrieveArtifact(
    convertedDatasetArtifactKey: string,
  ): Promise<string> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: convertedDatasetArtifactKey,
        }),
      );

      return response.Body!.transformToString();
    } catch (error: unknown) {
      if (isS3NotFound(error)) {
        throw new BasicError(
          BasicErrorType.NOT_FOUND,
          'CONVERTED_DATASET_ARTIFACT_NOT_FOUND',
          'Converted dataset artifact not found',
          `No converted dataset artifact found at key: ${convertedDatasetArtifactKey}`,
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

function parseConvertedDatasetArtifact(content: string): ConvertedDatasetRow[] {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'EMPTY_CONVERTED_DATASET_ARTIFACT',
      'Converted dataset artifact must contain at least one row',
    );
  }

  return lines.map((line, index) => parseConvertedDatasetLine(line, index + 1));
}

function parseConvertedDatasetLine(
  line: string,
  lineNumber: number,
): ConvertedDatasetRow {
  try {
    const value = JSON.parse(line) as unknown;
    return validateConvertedDatasetRow(value, lineNumber);
  } catch (error: unknown) {
    if (error instanceof BasicError) throw error;
    if (error instanceof SyntaxError) {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'INVALID_CONVERTED_DATASET_ARTIFACT_FORMAT',
        `Error parsing converted dataset artifact line ${lineNumber}: Invalid JSON`,
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown parsing error';
    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'INVALID_CONVERTED_DATASET_ARTIFACT_FORMAT',
      `Error parsing converted dataset artifact line ${lineNumber}: ${errorMessage}`,
    );
  }
}

function validateConvertedDatasetRow(
  value: unknown,
  lineNumber: number,
): ConvertedDatasetRow {
  if (!isRecord(value)) {
    throw invalidConvertedDatasetRow(lineNumber, 'line must be a JSON object');
  }

  const row: ConvertedDatasetRow = {
    chunk_id: readRequiredString(value, 'chunk_id', lineNumber),
    document_id: readRequiredString(value, 'document_id', lineNumber),
    text: readRequiredString(value, 'text', lineNumber),
  };

  if (value.summary !== undefined) {
    row.summary = readOptionalString(value, 'summary', lineNumber);
  }

  if (value.class !== undefined) {
    row.class = readOptionalString(value, 'class', lineNumber);
  }

  if (row.summary === undefined && row.class === undefined) {
    throw invalidConvertedDatasetRow(
      lineNumber,
      'either "summary" or "class" must be present',
    );
  }

  return row;
}

function readRequiredString(
  value: Record<string, unknown>,
  field: keyof ConvertedDatasetRow,
  lineNumber: number,
): string {
  const fieldValue = value[field];
  if (typeof fieldValue !== 'string' || fieldValue.trim().length === 0) {
    throw invalidConvertedDatasetRow(
      lineNumber,
      `"${field}" must be a non-empty string`,
    );
  }

  return fieldValue;
}

function readOptionalString(
  value: Record<string, unknown>,
  field: 'summary' | 'class',
  lineNumber: number,
): string {
  const fieldValue = value[field];
  if (typeof fieldValue !== 'string') {
    throw invalidConvertedDatasetRow(lineNumber, `"${field}" must be a string`);
  }

  return fieldValue;
}

function invalidConvertedDatasetRow(
  lineNumber: number,
  reason: string,
): BasicError {
  return new BasicError(
    BasicErrorType.UNPROCESSABLE_ENTITY,
    'INVALID_CONVERTED_DATASET_ARTIFACT_FORMAT',
    `Invalid converted dataset artifact line ${lineNumber}: ${reason}`,
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
