import { createInjectionToken, inject } from '@trackit.io/di-container';

import { Dataset, DatasetMetadata } from '../../models/Dataset';
import { tokenCsvParser } from '../../parsers/CsvParser/CsvParser';
import { tokenJsonlParser } from '../../parsers/JsonlParser/JsonlParser';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';
import {
  extractDatasetMetadata,
  validateDatasetSize,
} from '../datasetValidation';

export type ConfirmDatasetUploadUseCase = {
  confirmDatasetUpload(datasetId: string): Promise<DatasetMetadata>;
};

export class ConfirmDatasetUploadUseCaseImpl implements ConfirmDatasetUploadUseCase {
  private readonly csvParser = inject(tokenCsvParser);
  private readonly jsonlParser = inject(tokenJsonlParser);
  private readonly datasetService = inject(tokenDatasetService);

  async confirmDatasetUpload(datasetId: string): Promise<DatasetMetadata> {
    const { content, fileExtension } =
      await this.datasetService.retrieveDataset(datasetId);

    const dataset = this.parseDataset(content, fileExtension);
    validateDatasetSize(dataset);

    return extractDatasetMetadata(datasetId, dataset);
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
