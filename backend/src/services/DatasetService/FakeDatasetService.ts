import { createInjectionToken } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors/BasicError';
import { DatasetFileType, DocumentUploadManifest } from '../../models/Dataset';
import { DatasetService } from '../../ports/DatasetService';
import {
  convertedDatasetS3Key,
  documentS3Key,
} from '../../services/DatasetService/s3Keys';

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
    location: string,
    _contentType: string,
    maxBytes: number,
  ): Promise<{ url: string; fields: Record<string, string> }> {
    this.presignedMaxBytes.push(maxBytes);
    return {
      url: `https://fake-s3.test/${location}`,
      fields: { key: location, Policy: 'fake-policy' },
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
}

export const tokenFakeDatasetService = createInjectionToken<FakeDatasetService>(
  'FakeDatasetService',
  {
    useClass: FakeDatasetService,
  },
);
