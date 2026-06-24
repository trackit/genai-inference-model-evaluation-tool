import { createInjectionToken, inject } from '@trackit.io/di-container';
import { randomUUID } from 'crypto';

import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';
import { parseDatasetFileExtension } from '../datasetValidation';

export type InitializeDatasetUploadUseCase = {
  initDatasetUpload(filename: string): Promise<{
    dataset_id: string;
    upload_url: string;
    fields: Record<string, string>;
  }>;
};

export class InitializeDatasetUploadUseCaseImpl implements InitializeDatasetUploadUseCase {
  private readonly datasetService = inject(tokenDatasetService);

  async initDatasetUpload(filename: string): Promise<{
    dataset_id: string;
    upload_url: string;
    fields: Record<string, string>;
  }> {
    const fileExtension = parseDatasetFileExtension(filename);
    const datasetId = randomUUID();

    const { url, fields } = await this.datasetService.generatePresignedPost(
      datasetId,
      fileExtension,
    );

    return {
      dataset_id: datasetId,
      upload_url: url,
      fields,
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
