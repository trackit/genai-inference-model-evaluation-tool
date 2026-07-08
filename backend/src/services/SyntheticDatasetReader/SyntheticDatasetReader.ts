import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { SyntheticOutputRow } from '../../models/Preprocessing';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';

export interface SyntheticDatasetReader {
  readSyntheticRows(
    syntheticDatasetArtifactKey: string,
  ): Promise<SyntheticOutputRow[]>;
}

export class SyntheticDatasetReaderS3 implements SyntheticDatasetReader {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenClientS3);

  async readSyntheticRows(
    syntheticDatasetArtifactKey: string,
  ): Promise<SyntheticOutputRow[]> {
    if (!syntheticDatasetArtifactKey.trim()) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'SYNTHETIC_DATASET_ARTIFACT_KEY_REQUIRED',
        'Synthetic dataset artifact key is required',
      );
    }

    const content = await this.retrieveArtifact(syntheticDatasetArtifactKey);
    return parseSyntheticRows(content);
  }

  private async retrieveArtifact(
    syntheticDatasetArtifactKey: string,
  ): Promise<string> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: syntheticDatasetArtifactKey,
        }),
      );

      return response.Body!.transformToString();
    } catch (error: unknown) {
      if (isS3NotFound(error)) {
        throw new BasicError(
          BasicErrorType.NOT_FOUND,
          'SYNTHETIC_DATASET_ARTIFACT_NOT_FOUND',
          'Synthetic dataset artifact not found',
          `No synthetic dataset artifact found at key: ${syntheticDatasetArtifactKey}`,
        );
      }

      throw error;
    }
  }
}

export const tokenSyntheticDatasetReader =
  createInjectionToken<SyntheticDatasetReader>('SyntheticDatasetReader', {
    useClass: SyntheticDatasetReaderS3,
  });

function parseSyntheticRows(content: string): SyntheticOutputRow[] {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'EMPTY_SYNTHETIC_DATASET_ARTIFACT',
      'Synthetic dataset artifact must contain at least one row',
    );
  }

  return lines.map((line, index) => parseSyntheticRow(line, index + 1));
}

function parseSyntheticRow(
  line: string,
  lineNumber: number,
): SyntheticOutputRow {
  try {
    const value = JSON.parse(line) as unknown;
    return validateSyntheticRow(value, lineNumber);
  } catch (error: unknown) {
    if (error instanceof BasicError) throw error;
    if (error instanceof SyntaxError) {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'INVALID_SYNTHETIC_DATASET_ARTIFACT_FORMAT',
        `Error parsing synthetic dataset artifact line ${lineNumber}: Invalid JSON`,
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown parsing error';
    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'INVALID_SYNTHETIC_DATASET_ARTIFACT_FORMAT',
      `Error parsing synthetic dataset artifact line ${lineNumber}: ${errorMessage}`,
    );
  }
}

function validateSyntheticRow(
  value: unknown,
  lineNumber: number,
): SyntheticOutputRow {
  if (!isRecord(value)) {
    throw invalidSyntheticRow(lineNumber, 'line must be a JSON object');
  }

  const row: SyntheticOutputRow = {
    document_id: readRequiredString(value, 'document_id', lineNumber),
    chunk_id: readRequiredString(value, 'chunk_id', lineNumber),
    text: readRequiredString(value, 'text', lineNumber),
    status: readStatus(value, lineNumber),
  };

  if (value.summary !== undefined) {
    row.summary = readOptionalString(value, 'summary', lineNumber);
  }

  if (value.class !== undefined) {
    row.class = readOptionalString(value, 'class', lineNumber);
  }

  if (value.error_message !== undefined) {
    row.error_message = readOptionalString(value, 'error_message', lineNumber);
  }

  if (value.model_id !== undefined) {
    row.model_id = readOptionalString(value, 'model_id', lineNumber);
  }

  if (row.summary === undefined && row.class === undefined) {
    throw invalidSyntheticRow(
      lineNumber,
      'either "summary" or "class" must be present',
    );
  }

  return row;
}

function readRequiredString(
  value: Record<string, unknown>,
  field: keyof SyntheticOutputRow,
  lineNumber: number,
): string {
  const fieldValue = value[field];
  if (typeof fieldValue !== 'string' || fieldValue.trim().length === 0) {
    throw invalidSyntheticRow(
      lineNumber,
      `"${field}" must be a non-empty string`,
    );
  }

  return fieldValue;
}

function readOptionalString(
  value: Record<string, unknown>,
  field: keyof SyntheticOutputRow,
  lineNumber: number,
): string {
  const fieldValue = value[field];
  if (typeof fieldValue !== 'string') {
    throw invalidSyntheticRow(lineNumber, `"${field}" must be a string`);
  }

  return fieldValue;
}

function readStatus(
  value: Record<string, unknown>,
  lineNumber: number,
): SyntheticOutputRow['status'] {
  const status = value.status;
  if (status !== 'completed' && status !== 'failed') {
    throw invalidSyntheticRow(
      lineNumber,
      '"status" must be "completed" or "failed"',
    );
  }

  return status;
}

function invalidSyntheticRow(lineNumber: number, reason: string): BasicError {
  return new BasicError(
    BasicErrorType.UNPROCESSABLE_ENTITY,
    'INVALID_SYNTHETIC_DATASET_ARTIFACT_FORMAT',
    `Invalid synthetic dataset artifact line ${lineNumber}: ${reason}`,
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
