import { createInjectionToken, inject } from '@trackit.io/di-container';

import { Dataset, DatasetPreview } from '../../models/Dataset';
import { tokenCsvParser } from '../../parsers/CsvParser/CsvParser';
import { tokenJsonlParser } from '../../parsers/JsonlParser/JsonlParser';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';

const PREVIEW_LIMIT = 10;

export type GetDatasetPreviewUseCase = {
  getDatasetPreview(datasetId: string): Promise<DatasetPreview>;
};

export class GetDatasetPreviewUseCaseImpl implements GetDatasetPreviewUseCase {
  private readonly csvParser = inject(tokenCsvParser);
  private readonly jsonlParser = inject(tokenJsonlParser);
  private readonly datasetService = inject(tokenDatasetService);

  async getDatasetPreview(datasetId: string): Promise<DatasetPreview> {
    const { content, fileExtension } =
      await this.datasetService.retrieveDataset(datasetId);

    const dataset: Dataset =
      fileExtension === 'csv'
        ? this.csvParser.parse(content)
        : this.jsonlParser.parse(content);

    return {
      dataset_id: datasetId,
      samples: dataset.samples.slice(0, PREVIEW_LIMIT),
    };
  }
}

export const tokenGetDatasetPreviewUseCase =
  createInjectionToken<GetDatasetPreviewUseCase>('GetDatasetPreviewUseCase', {
    useClass: GetDatasetPreviewUseCaseImpl,
  });
