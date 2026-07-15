import { createInjectionToken, inject } from '@trackit.io/di-container';
import { randomUUID } from 'crypto';

import { BasicError, BasicErrorType } from '../../errors/BasicError';
import {
  DatasetFileType,
  DocumentUploadManifestEntry,
  MAX_DATASET_BYTES,
} from '../../models/Dataset';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';
import {
  fileContentType,
  isDatasetFile,
  isDocumentFile,
  parseFileType,
  validateDeclaredTotalSize,
} from '../datasetValidation';

export type FileUploadRequest = {
  filename: string;
  size_bytes: number;
};

type ParsedFile = FileUploadRequest & { fileType: DatasetFileType };

export type FileUpload = {
  document_id: string;
  upload_url: string;
  fields: Record<string, string>;
};

export type InitializeDatasetUploadResult = {
  dataset_id: string;
  file_type?: 'csv' | 'jsonl';
  uploads: FileUpload[];
};

export type InitializeDatasetUploadUseCase = {
  initDatasetUpload(
    files: FileUploadRequest[],
  ): Promise<InitializeDatasetUploadResult>;
};

export class InitializeDatasetUploadUseCaseImpl implements InitializeDatasetUploadUseCase {
  private readonly datasetService = inject(tokenDatasetService);

  async initDatasetUpload(
    files: FileUploadRequest[],
  ): Promise<InitializeDatasetUploadResult> {
    if (files.length === 0) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'NO_FILES',
        'At least one file is required',
      );
    }

    const datasetId = randomUUID();

    const parsed: ParsedFile[] = files.map((file) => ({
      ...file,
      fileType: parseFileType(file.filename),
    }));

    const datasetFiles = parsed.filter((file) => isDatasetFile(file.fileType));
    if (datasetFiles.length > 0 && files.length !== 1) {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'DATASET_MIXED_WITH_DOCUMENTS',
        'CSV/JSONL datasets must be uploaded alone',
      );
    }
    if (datasetFiles.length > 0) {
      const file = datasetFiles[0];
      const { url, fields } = await this.datasetService.generatePresignedPost(
        datasetId,
        file.fileType,
        fileContentType(file.fileType),
        file.size_bytes,
      );

      return {
        dataset_id: datasetId,
        file_type: file.fileType as 'csv' | 'jsonl',
        uploads: [
          {
            document_id: datasetId,
            upload_url: url,
            fields,
          },
        ],
      };
    }

    const documentFiles = parsed.filter((file) =>
      isDocumentFile(file.fileType),
    );
    validateDeclaredTotalSize(documentFiles.map((file) => file.size_bytes));

    const manifestFiles: DocumentUploadManifestEntry[] = [];

    const uploads = await Promise.all(
      documentFiles.map(async (file) => {
        const documentId = randomUUID();
        const { url, fields, key } =
          await this.datasetService.generatePresignedPost(
            datasetId,
            file.fileType,
            fileContentType(file.fileType),
            file.size_bytes,
            documentId,
          );

        manifestFiles.push({
          document_id: documentId,
          filename: file.filename,
          file_type: file.fileType,
          s3_key: key,
          size_bytes: file.size_bytes,
        });

        return {
          document_id: documentId,
          upload_url: url,
          fields,
        };
      }),
    );

    console.info('Presigned URLs generated for document files');

    await this.datasetService.writeUploadManifest(datasetId, {
      max_total_bytes: MAX_DATASET_BYTES,
      files: manifestFiles,
    });

    console.info(`Upload manifest file added to datasets/${datasetId}`);

    return {
      dataset_id: datasetId,
      uploads,
    };
  }
}

export const tokenInitializeDatasetUploadUseCase =
  createInjectionToken<InitializeDatasetUploadUseCase>(
    'InitializeDatasetUploadUseCase',
    {
      useClass: InitializeDatasetUploadUseCaseImpl,
    },
  );
