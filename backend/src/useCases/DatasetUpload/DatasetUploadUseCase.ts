import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { Dataset, DatasetMetadata } from '../../models/Dataset';
import { tokenCsvParser } from '../../parsers/CsvParser/CsvParser';
import { tokenJsonlParser } from '../../parsers/JsonlParser/JsonlParser';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';

export type DatasetUploadUseCase = {
  execute(content: string, filename: string): Promise<DatasetMetadata>;
};

export class DatasetUploadUseCaseImpl implements DatasetUploadUseCase {
  private readonly csvParser = inject(tokenCsvParser);
  private readonly jsonlParser = inject(tokenJsonlParser);
  private readonly datasetService = inject(tokenDatasetService);

  async execute(content: string, filename: string): Promise<DatasetMetadata> {
    const fileExtension = this.getFileExtension(filename);

    this.validateFileSize(content);

    const dataset = this.parseDataset(content, fileExtension);

    this.validateDatasetSize(dataset);

    this.scanForMaliciousContent(content);

    return await this.datasetService.uploadDataset(
      content,
      fileExtension,
      dataset,
    );
  }

  private getFileExtension(filename: string): 'csv' | 'jsonl' {
    const extension = filename.toLowerCase().split('.').pop();

    if (extension === 'csv') {
      return 'csv';
    } else if (extension === 'jsonl') {
      return 'jsonl';
    }

    throw new BasicError(
      BasicErrorType.BAD_REQUEST,
      'INVALID_FILE_FORMAT',
      'Invalid file format. Only CSV and JSONL files are supported',
    );
  }

  private validateFileSize(content: string): void {
    const sizeInBytes = Buffer.byteLength(content, 'utf8');
    const maxSizeInBytes = 200 * 1024 * 1024;
    const minSizeInBytes = 10;

    if (sizeInBytes > maxSizeInBytes) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'FILE_TOO_LARGE',
        'File size exceeds maximum limit of 200MB',
      );
    }

    if (sizeInBytes < minSizeInBytes) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'FILE_TOO_SMALL',
        'File is too small to be a valid dataset',
      );
    }
  }

  private parseDataset(
    content: string,
    fileExtension: 'csv' | 'jsonl',
  ): Dataset {
    if (fileExtension === 'csv') {
      return this.csvParser.parse(content);
    } else {
      return this.jsonlParser.parse(content);
    }
  }

  private validateDatasetSize(dataset: Dataset): void {
    if (dataset.samples.length < 10) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INSUFFICIENT_SAMPLES',
        `Dataset must contain at least 10 samples. Found ${dataset.samples.length} samples`,
      );
    }
  }

  private scanForMaliciousContent(content: string): void {
    const maliciousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /eval\(/gi,
      /expression\(/gi,
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(content)) {
        throw new BasicError(
          BasicErrorType.BAD_REQUEST,
          'MALICIOUS_CONTENT',
          'File contains potentially malicious content',
        );
      }
    }
  }
}

export const tokenDatasetUploadUseCase =
  createInjectionToken<DatasetUploadUseCase>('DatasetUploadUseCase', {
    useClass: DatasetUploadUseCaseImpl,
  });
