import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import {
  Dataset,
  DatasetConfirmMetadata,
  DocumentUploadManifest,
} from '../../models/Dataset';
import { tokenCsvParser } from '../../parsers/CsvParser/CsvParser';
import { tokenJsonlParser } from '../../parsers/JsonlParser/JsonlParser';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';
import {
  extractDatasetMetadata,
  validateDatasetSize,
  validateDeclaredTotalSize,
  validateUploadedFileSize,
} from '../datasetValidation';

export type ConfirmDatasetUploadUseCase = {
  confirmDatasetUpload(
    datasetId: string,
    file_type?: 'csv' | 'jsonl',
  ): Promise<DatasetConfirmMetadata>;
};

export class ConfirmDatasetUploadUseCaseImpl implements ConfirmDatasetUploadUseCase {
  private readonly csvParser = inject(tokenCsvParser);
  private readonly jsonlParser = inject(tokenJsonlParser);
  private readonly datasetService = inject(tokenDatasetService);

  async confirmDatasetUpload(
    datasetId: string,
    file_type?: 'csv' | 'jsonl',
  ): Promise<DatasetConfirmMetadata> {
    const manifest = await this.datasetService.readUploadManifest(datasetId);
    if (manifest) {
      return this.confirmDocumentUpload(datasetId, manifest);
    }

    if (!file_type) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'MISSING_FILE_TYPE',
        'file_type is required to confirm a structured dataset upload',
      );
    }

    return this.confirmStructuredDatasetUpload(datasetId, file_type);
  }

  private async confirmStructuredDatasetUpload(
    datasetId: string,
    file_type: 'csv' | 'jsonl',
  ): Promise<DatasetConfirmMetadata> {
    const content = await this.datasetService.retrieveDataset(
      datasetId,
      file_type,
    );

    const dataset = this.parseDataset(content, file_type);
    validateDatasetSize(dataset);

    console.info(`Upload done for structured dataset`);

    return extractDatasetMetadata(datasetId, dataset);
  }

  private async confirmDocumentUpload(
    datasetId: string,
    manifest: DocumentUploadManifest,
  ): Promise<DatasetConfirmMetadata> {
    const documents = [];

    for (const file of manifest.files) {
      const actualSize = await this.datasetService.getUploadedObjectSize(
        file.s3_key,
      );
      validateUploadedFileSize(actualSize, file.size_bytes);
      documents.push({
        filename: file.filename,
        file_type: file.file_type,
        size_bytes: actualSize,
      });
    }

    validateDeclaredTotalSize(documents.map((document) => document.size_bytes));

    console.info(`Upload done for ${documents.length} document files`);

    return {
      dataset_type: 'documents',
      dataset_id: datasetId,
      file_count: documents.length,
      documents: documents.map((document) => ({
        filename: document.filename,
        file_type: document.file_type,
      })),
    };
  }

  private parseDataset(
    content: string,
    fileExtension: 'csv' | 'jsonl',
  ): Dataset {
    return fileExtension === 'csv'
      ? this.csvParser.parse(content)
      : this.jsonlParser.parse(content);
  }
}

export const tokenConfirmDatasetUploadUseCase =
  createInjectionToken<ConfirmDatasetUploadUseCase>(
    'ConfirmDatasetUploadUseCase',
    {
      useClass: ConfirmDatasetUploadUseCaseImpl,
    },
  );
