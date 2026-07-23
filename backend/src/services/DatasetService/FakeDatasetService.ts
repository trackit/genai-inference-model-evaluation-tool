import { createInjectionToken } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors/BasicError';
import {
  DatasetFileType,
  DatasetSample,
  DocumentUploadManifest,
} from '../../models/Dataset';
import {
  ConvertedDatasetRow,
  SyntheticOutputRow,
} from '../../models/SyntheticOutput';
import { DatasetService } from '../../ports/DatasetService';
import {
  convertedDatasetS3Key,
  datasetS3Key,
  documentS3Key,
  structuredDatasetS3Key,
  syntheticDatasetS3Key,
} from './DatasetServiceS3';

export type StoredDatasetUpload = {
  datasetId: string;
  content: string;
  fileExtension: 'csv' | 'jsonl';
};

export type StoredRawContent = {
  datasetId: string;
  documentId: string;
  fileType: 'pdf' | 'doc' | 'docx';
  content: Buffer;
};

export type StoredConvertedDataset = {
  key: string;
  jsonl: string;
};

export class FakeDatasetService implements DatasetService {
  public readonly uploads: StoredDatasetUpload[] = [];
  public readonly artifacts: Array<{
    key: string;
    body: string;
    contentType: string;
  }> = [];
  public readonly manifests = new Map<string, DocumentUploadManifest>();
  public readonly documentObjects = new Map<string, number>();
  public readonly presignedMaxBytes: number[] = [];
  public readonly rawContents: StoredRawContent[] = [];
  public readonly convertedDatasets: StoredConvertedDataset[] = [];

  seedRawContent(
    datasetId: string,
    documentId: string,
    fileType: 'pdf' | 'doc' | 'docx',
    content: Buffer,
  ) {
    this.rawContents.push({
      datasetId,
      documentId,
      fileType,
      content,
    });
  }

  seedConvertedDatasetRows(key: string, rows: ConvertedDatasetRow[]): void {
    this.artifacts.push({
      key,
      body: rows.map((row) => JSON.stringify(row)).join('\n'),
      contentType: 'application/jsonl',
    });
  }

  async upload(
    datasetId: string,
    content: string,
    fileExtension: 'csv' | 'jsonl',
  ): Promise<void> {
    const index = this.uploads.findIndex((u) => u.datasetId === datasetId);
    const entry = { datasetId, content, fileExtension };
    if (index >= 0) {
      this.uploads[index] = entry;
    } else {
      this.uploads.push(entry);
    }
  }

  uploadDocument(s3Key: string, sizeBytes: number): void {
    this.documentObjects.set(s3Key, sizeBytes);
  }

  async generatePresignedPost(
    datasetId: string,
    fileType: DatasetFileType,
    _contentType: string,
    maxBytes: number,
    documentId?: string,
  ): Promise<{
    url: string;
    fields: Record<string, string>;
    key: string;
  }> {
    this.presignedMaxBytes.push(maxBytes);
    const key = documentId
      ? documentS3Key(datasetId, documentId, fileType)
      : datasetS3Key(datasetId, fileType as 'csv' | 'jsonl');
    return {
      url: `https://fake-s3.test/${key}`,
      fields: { key: key, Policy: 'fake-policy' },
      key,
    };
  }

  async retrieveDataset(
    datasetId: string,
  ): Promise<{ content: string; fileExtension: 'csv' | 'jsonl' }> {
    const stored = this.uploads.find((u) => u.datasetId === datasetId);
    if (!stored) {
      throw new BasicError(
        BasicErrorType.NOT_FOUND,
        'DATASET_NOT_FOUND',
        'Dataset not found',
        `No dataset found with ID: ${datasetId}`,
      );
    }
    return {
      content: stored.content,
      fileExtension: stored.fileExtension,
    };
  }

  async writeUploadManifest(
    datasetId: string,
    manifest: DocumentUploadManifest,
  ): Promise<void> {
    this.manifests.set(datasetId, manifest);
  }

  async readUploadManifest(
    datasetId: string,
  ): Promise<DocumentUploadManifest | null> {
    return this.manifests.get(datasetId) ?? null;
  }

  async getUploadedObjectSize(s3Key: string): Promise<number> {
    const size = this.documentObjects.get(s3Key);
    if (size === undefined) {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'UPLOAD_INCOMPLETE',
        'One or more files were not uploaded',
        `Missing object: ${s3Key}`,
      );
    }
    return size;
  }

  async readConvertedDatasetRows(
    convertedDatasetArtifactKey: string,
  ): Promise<ConvertedDatasetRow[]> {
    const content = this.readArtifactContent(convertedDatasetArtifactKey);
    return parseJsonlRows<ConvertedDatasetRow>(content);
  }

  async writeSyntheticDataset(
    datasetId: string,
    rows: SyntheticOutputRow[],
  ): Promise<{ syntheticDatasetArtifactKey: string }> {
    const syntheticDatasetArtifactKey = syntheticDatasetS3Key(datasetId);
    this.writeArtifactContent(
      syntheticDatasetArtifactKey,
      serializeJsonlRows(rows),
    );

    return { syntheticDatasetArtifactKey };
  }

  async readSyntheticDatasetRows(
    syntheticDatasetArtifactKey: string,
  ): Promise<SyntheticOutputRow[]> {
    const content = this.readArtifactContent(syntheticDatasetArtifactKey);
    return parseJsonlRows<SyntheticOutputRow>(content);
  }

  async writeStructuredDataset(
    datasetId: string,
    samples: DatasetSample[],
  ): Promise<{ structuredDatasetArtifactKey: string }> {
    const structuredDatasetArtifactKey = structuredDatasetS3Key(datasetId);
    this.writeArtifactContent(
      structuredDatasetArtifactKey,
      serializeJsonlRows(
        samples.map((sample) => ({
          document: sample.document,
          ...(sample.summary !== undefined && { summary: sample.summary }),
          ...(sample.class_label !== undefined && {
            class: sample.class_label,
          }),
        })),
      ),
    );

    return { structuredDatasetArtifactKey };
  }

  async storeConversionJsonl(
    datasetId: string,
    jsonl: string,
  ): Promise<string> {
    const convertedDatasetFileKey = convertedDatasetS3Key(datasetId);
    this.convertedDatasets.push({
      key: convertedDatasetFileKey,
      jsonl,
    });

    return convertedDatasetFileKey;
  }

  async fetchRawContent(
    datasetId: string,
    documentId: string,
    fileType: DatasetFileType,
  ): Promise<Buffer> {
    const stored = this.rawContents.find(
      (r) =>
        r.datasetId === datasetId &&
        r.documentId === documentId &&
        r.fileType === fileType,
    );
    if (!stored) {
      throw new BasicError(
        BasicErrorType.NOT_FOUND,
        'RAW_CONTENT_NOT_FOUND',
        'Raw content not found',
        `No raw content found for key: ${documentS3Key(datasetId, documentId, fileType)}`,
      );
    }
    return stored.content;
  }

  private syntheticRows: Record<string, Record<string, SyntheticOutputRow>> =
    {};

  async writeSyntheticRow(
    datasetId: string,
    chunkId: string,
    row: SyntheticOutputRow,
  ): Promise<void> {
    this.syntheticRows[datasetId] ??= {};
    this.syntheticRows[datasetId][chunkId] = row;
  }

  async readSyntheticRows(datasetId: string): Promise<SyntheticOutputRow[]> {
    return Object.values(this.syntheticRows[datasetId] ?? {});
  }

  async deleteSyntheticRows(datasetId: string): Promise<void> {
    delete this.syntheticRows[datasetId];
  }

  private readArtifactContent(key: string): string {
    const artifact = this.artifacts.find((a) => a.key === key);
    if (!artifact) {
      throw new BasicError(
        BasicErrorType.NOT_FOUND,
        'DATASET_ARTIFACT_NOT_FOUND',
        'Dataset artifact not found',
        `No dataset artifact found at key: ${key}`,
      );
    }

    return artifact.body;
  }

  private writeArtifactContent(key: string, body: string): void {
    const artifact = {
      key,
      body,
      contentType: 'application/jsonl',
    };
    const index = this.artifacts.findIndex((a) => a.key === key);
    if (index >= 0) {
      this.artifacts[index] = artifact;
    } else {
      this.artifacts.push(artifact);
    }
  }
}

export const tokenFakeDatasetService = createInjectionToken<FakeDatasetService>(
  'FakeDatasetService',
  {
    useClass: FakeDatasetService,
  },
);

function parseJsonlRows<T>(content: string): T[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function serializeJsonlRows(rows: unknown[]): string {
  if (rows.length === 0) return '';
  return `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
}
