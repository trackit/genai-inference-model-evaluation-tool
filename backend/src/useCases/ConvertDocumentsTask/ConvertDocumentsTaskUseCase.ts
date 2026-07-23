import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { DatasetFileType } from '../../models/Dataset';
import {
  ChunkingStrategy,
  SUPPORTED_DOCUMENT_FILE_TYPES,
  SupportedDocumentFileType,
} from '../../models/DocumentConversion';
import { SyntheticOutputTaskType } from '../../models/SyntheticOutput';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';
import { tokenDocumentConversionUseCase } from '../DocumentConversion/DocumentConversionUseCase';

export interface ConvertDocumentsTaskInput {
  datasetId: string;
  taskType: SyntheticOutputTaskType;
  chunkingStrategy: ChunkingStrategy;
}

export interface ConvertDocumentsTaskOutput {
  datasetId: string;
  taskType: SyntheticOutputTaskType;
  convertedDatasetArtifactKey: string;
}

function isSupportedDocumentType(
  fileType: DatasetFileType,
): fileType is SupportedDocumentFileType {
  return (SUPPORTED_DOCUMENT_FILE_TYPES as readonly string[]).includes(
    fileType,
  );
}

export type ConvertDocumentsTaskUseCase = {
  execute(
    input: ConvertDocumentsTaskInput,
  ): Promise<ConvertDocumentsTaskOutput>;
};

export class ConvertDocumentsTaskUseCaseImpl
  implements ConvertDocumentsTaskUseCase
{
  private readonly datasetService = inject(tokenDatasetService);
  private readonly documentConversionUseCase = inject(
    tokenDocumentConversionUseCase,
  );

  async execute({
    datasetId,
    taskType,
    chunkingStrategy,
  }: ConvertDocumentsTaskInput): Promise<ConvertDocumentsTaskOutput> {
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

    // Clear any synthetic rows left by a previous run so a re-run with a
    // different chunking strategy or task type cannot mix stale rows in.
    await this.datasetService.deleteSyntheticRows(datasetId);

    const convertedDatasetArtifactKey =
      await this.documentConversionUseCase.execute({
        dataset_id: datasetId,
        documents,
        chunking_strategy: chunkingStrategy,
      });

    return { datasetId, taskType, convertedDatasetArtifactKey };
  }
}

export const tokenConvertDocumentsTaskUseCase =
  createInjectionToken<ConvertDocumentsTaskUseCase>(
    'ConvertDocumentsTaskUseCase',
    { useClass: ConvertDocumentsTaskUseCaseImpl },
  );
