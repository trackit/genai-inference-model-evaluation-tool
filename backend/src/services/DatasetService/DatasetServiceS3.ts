import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { createInjectionToken, inject } from '@trackit.io/di-container';
import { z } from 'zod';
import { BasicError, BasicErrorType } from '../../errors/BasicError';
import {
  DatasetFileType,
  DatasetSample,
  DocumentUploadManifest,
  MIN_FILE_BYTES,
} from '../../models/Dataset';
import {
  ConvertedDatasetRow,
  SyntheticOutputRow,
} from '../../models/SyntheticOutput';
import { DatasetService } from '../../ports/DatasetService';

const DocumentUploadManifestSchema = z.object({
  max_total_bytes: z.number().int().positive(),
  files: z.array(
    z.object({
      document_id: z.string().min(1),
      filename: z.string().min(1),
      file_type: z.enum(['csv', 'jsonl', 'pdf', 'doc', 'docx']),
      s3_key: z.string().min(1),
      size_bytes: z.number().int().min(MIN_FILE_BYTES),
    }),
  ),
});

export function datasetS3Key(
  datasetId: string,
  fileType: 'csv' | 'jsonl',
): string {
  return `datasets/${datasetId}/${datasetId}.${fileType}`;
}

export function documentS3Key(
  datasetId: string,
  documentId: string,
  fileType: DatasetFileType,
): string {
  return `datasets/${datasetId}/${documentId}.${fileType}`;
}

export function convertedDatasetS3Key(datasetId: string): string {
  return `datasets/${datasetId}/${datasetId}-converted.jsonl`;
}

export function syntheticDatasetS3Key(datasetId: string): string {
  return `datasets/${datasetId}/${datasetId}-synthetic.jsonl`;
}

export function structuredDatasetS3Key(datasetId: string): string {
  return `datasets/${datasetId}/${datasetId}.jsonl`;
}

export class DatasetServiceImpl implements DatasetService {
  private readonly bucketName = process.env.DATASET_BUCKET!;
  private readonly s3Client = inject(tokenClientS3);
  private readonly PRESIGNED_POST_EXPIRY_SECONDS = 1800;

  private getUploadKey(
    datasetId: string,
    fileType: DatasetFileType,
    documentId?: string,
  ): string {
    if (fileType === 'csv' || fileType === 'jsonl') {
      return datasetS3Key(datasetId, fileType);
    }

    if (!documentId) {
      throw new Error('documentId is required for document uploads');
    }

    return documentS3Key(datasetId, documentId, fileType);
  }

  async generatePresignedPost(
    datasetId: string,
    fileType: DatasetFileType,
    contentType: string,
    maxBytes: number,
    documentId?: string,
  ): Promise<{
    url: string;
    fields: Record<string, string>;
    key: string;
  }> {
    const key = this.getUploadKey(datasetId, fileType, documentId);
    const { url, fields } = await createPresignedPost(this.s3Client, {
      Bucket: this.bucketName,
      Key: key,
      Conditions: [
        ['content-length-range', MIN_FILE_BYTES, maxBytes],
        ['eq', '$Content-Type', contentType],
        ['eq', '$x-amz-server-side-encryption', 'AES256'],
      ],
      Fields: {
        'Content-Type': contentType,
        'x-amz-server-side-encryption': 'AES256',
      },
      Expires: this.PRESIGNED_POST_EXPIRY_SECONDS,
    });

    return { url, fields, key };
  }

  async writeUploadManifest(
    datasetId: string,
    manifest: DocumentUploadManifest,
  ): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `datasets/${datasetId}/.upload-manifest.json`,
        Body: JSON.stringify(manifest),
        ContentType: 'application/json',
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async readUploadManifest(
    datasetId: string,
  ): Promise<DocumentUploadManifest | null> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: `datasets/${datasetId}/.upload-manifest.json`,
        }),
      );
      const body = await response.Body!.transformToString();
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new BasicError(
          BasicErrorType.UNPROCESSABLE_ENTITY,
          'INVALID_MANIFEST',
          'Upload manifest is not valid JSON',
        );
      }
      const result = DocumentUploadManifestSchema.safeParse(parsed);
      if (!result.success) {
        throw new BasicError(
          BasicErrorType.UNPROCESSABLE_ENTITY,
          'INVALID_MANIFEST',
          'Upload manifest has invalid structure',
          result.error.message,
        );
      }
      return result.data;
    } catch (error: unknown) {
      if (isS3NotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  async getUploadedObjectSize(s3Key: string): Promise<number> {
    try {
      const response = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
        }),
      );
      return response.ContentLength ?? 0;
    } catch (error: unknown) {
      if (isS3NotFound(error)) {
        throw new BasicError(
          BasicErrorType.UNPROCESSABLE_ENTITY,
          'UPLOAD_INCOMPLETE',
          'One or more files were not uploaded',
          `Missing object: ${s3Key}`,
        );
      }
      throw error;
    }
  }

  async retrieveDataset(
    datasetId: string,
    file_type: 'csv' | 'jsonl',
  ): Promise<string> {
    try {
      const datasetKey = datasetS3Key(datasetId, file_type);
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: datasetKey,
        }),
      );
      const content = await response.Body!.transformToString();
      return content;
    } catch (error: unknown) {
      if (isS3NotFound(error)) {
        throw new BasicError(
          BasicErrorType.NOT_FOUND,
          'DATASET_NOT_FOUND',
          'Dataset not found',
          `No dataset found with ID: ${datasetId}`,
        );
      }
      throw error;
    }
  }

  async storeConversionJsonl(
    datasetId: string,
    jsonl: string,
  ): Promise<string> {
    const convertedDatasetFileKey = convertedDatasetS3Key(datasetId);
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: convertedDatasetFileKey,
        Body: jsonl,
        ContentType: 'application/jsonl',
        ServerSideEncryption: 'AES256',
      }),
    );

    return convertedDatasetFileKey;
  }

  async fetchRawContent(
    datasetId: string,
    documentId: string,
    fileType: DatasetFileType,
  ): Promise<Buffer> {
    const documentKey = documentS3Key(datasetId, documentId, fileType);
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucketName, Key: documentKey }),
      );

      if (!response.Body) {
        throw new Error('S3 returned no response body');
      }

      return Buffer.from(await response.Body.transformToByteArray());
    } catch (error: unknown) {
      if (isS3NotFound(error)) {
        throw new BasicError(
          BasicErrorType.NOT_FOUND,
          'DOCUMENT_NOT_FOUND',
          'Document not found',
          `No document found with key: ${documentKey}`,
        );
      }
      throw error;
    }
  }

  async readConvertedDatasetRows(
    convertedDatasetArtifactKey: string,
  ): Promise<ConvertedDatasetRow[]> {
    if (!convertedDatasetArtifactKey.trim()) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'CONVERTED_DATASET_ARTIFACT_KEY_REQUIRED',
        'Converted dataset artifact key is required',
      );
    }

    try {
      const content = await this.retrieveArtifact(convertedDatasetArtifactKey);
      return parseConvertedDatasetArtifact(content);
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

  async writeSyntheticDataset(
    datasetId: string,
    rows: SyntheticOutputRow[],
  ): Promise<{ syntheticDatasetArtifactKey: string }> {
    if (!datasetId.trim()) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'DATASET_ID_REQUIRED',
        'Dataset ID is required',
      );
    }

    const syntheticDatasetArtifactKey = syntheticDatasetS3Key(datasetId);
    await this.writeArtifact(
      syntheticDatasetArtifactKey,
      serializeSyntheticRows(rows),
    );

    return { syntheticDatasetArtifactKey };
  }

  async readSyntheticDatasetRows(
    syntheticDatasetArtifactKey: string,
  ): Promise<SyntheticOutputRow[]> {
    if (!syntheticDatasetArtifactKey.trim()) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'SYNTHETIC_DATASET_ARTIFACT_KEY_REQUIRED',
        'Synthetic dataset artifact key is required',
      );
    }

    try {
      const content = await this.retrieveArtifact(syntheticDatasetArtifactKey);
      return parseSyntheticRows(content);
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

  async writeStructuredDataset(
    datasetId: string,
    samples: DatasetSample[],
  ): Promise<{ structuredDatasetArtifactKey: string }> {
    if (!datasetId.trim()) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'DATASET_ID_REQUIRED',
        'Dataset ID is required',
      );
    }

    const structuredDatasetArtifactKey = structuredDatasetS3Key(datasetId);
    await this.writeArtifact(
      structuredDatasetArtifactKey,
      serializeSamples(samples),
    );

    return { structuredDatasetArtifactKey };
  }

  private async retrieveArtifact(key: string): Promise<string> {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );

    return response.Body!.transformToString();
  }

  private async writeArtifact(key: string, body: string): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: 'application/jsonl',
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async getDatasetFileType(datasetId: string): Promise<DatasetFileType | null> {
    const manifest = await this.readUploadManifest(datasetId);

    if (!manifest) {
      return null;
    }

    return (
      manifest.files.find(
        (file) => file.file_type === 'csv' || file.file_type === 'jsonl',
      )?.file_type ?? 'jsonl'
    );
  }
}

export const tokenClientS3 = createInjectionToken<S3Client>('ClientS3', {
  useClass: S3Client,
});

export const tokenDatasetService = createInjectionToken<DatasetService>(
  'DatasetService',
  { useClass: DatasetServiceImpl },
);

function isS3NotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'NoSuchKey' || error.name === 'NotFound')
  );
}

function serializeSyntheticRows(rows: SyntheticOutputRow[]): string {
  if (rows.length === 0) return '';
  return `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
}

function serializeSamples(samples: DatasetSample[]): string {
  if (samples.length === 0) return '';

  return `${samples
    .map((sample) =>
      JSON.stringify({
        document: sample.document,
        ...(sample.summary !== undefined && { summary: sample.summary }),
        ...(sample.class_label !== undefined && { class: sample.class_label }),
      }),
    )
    .join('\n')}\n`;
}

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
    chunk_id: readRequiredConvertedString(value, 'chunk_id', lineNumber),
    document_id: readRequiredConvertedString(value, 'document_id', lineNumber),
    document: readRequiredConvertedString(value, 'document', lineNumber),
  };

  return row;
}

function readRequiredConvertedString(
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
    document_id: readRequiredSyntheticString(value, 'document_id', lineNumber),
    chunk_id: readRequiredSyntheticString(value, 'chunk_id', lineNumber),
    text: readRequiredSyntheticString(value, 'text', lineNumber),
    status: readStatus(value, lineNumber),
  };

  if (value.summary !== undefined) {
    row.summary = readOptionalSyntheticString(value, 'summary', lineNumber);
  }

  if (value.class !== undefined) {
    row.class = readOptionalSyntheticString(value, 'class', lineNumber);
  }

  if (value.error_message !== undefined) {
    row.error_message = readOptionalSyntheticString(
      value,
      'error_message',
      lineNumber,
    );
  }

  if (value.model_id !== undefined) {
    row.model_id = readOptionalSyntheticString(value, 'model_id', lineNumber);
  }

  if (row.summary === undefined && row.class === undefined) {
    throw invalidSyntheticRow(
      lineNumber,
      'either "summary" or "class" must be present',
    );
  }

  return row;
}

function readRequiredSyntheticString(
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

function readOptionalSyntheticString(
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
