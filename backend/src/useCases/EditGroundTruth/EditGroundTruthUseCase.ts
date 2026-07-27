import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { Dataset, DatasetSample } from '../../models/Dataset';
import { tokenCsvParser } from '../../parsers/CsvParser/CsvParser';
import { tokenJsonlParser } from '../../parsers/JsonlParser/JsonlParser';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';

export type EditGroundTruthInput = {
  datasetId: string;
  edits: Record<string, string>;
};

export type EditGroundTruthOutput = {
  datasetId: string;
  edits: Record<string, string>;
};

export type EditGroundTruthUseCase = {
  editGroundTruth(input: EditGroundTruthInput): Promise<EditGroundTruthOutput>;
};

export class EditGroundTruthUseCaseImpl implements EditGroundTruthUseCase {
  private readonly csvParser = inject(tokenCsvParser);
  private readonly jsonlParser = inject(tokenJsonlParser);
  private readonly datasetService = inject(tokenDatasetService);

  private trimEdits(edits: Record<string, string>): Record<string, string> {
    const trimmedEdits: Record<string, string> = {};
    for (const [sampleId, value] of Object.entries(edits)) {
      const trimmed = value.trim();
      if (!trimmed) {
        throw new BasicError(
          BasicErrorType.BAD_REQUEST,
          'CORRECTED_GROUND_TRUTH_REQUIRED',
          'Corrected ground truth cannot be empty',
          `Sample ${sampleId} has an empty correction`,
        );
      }
      trimmedEdits[sampleId] = trimmed;
    }

    if (Object.keys(trimmedEdits).length === 0) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'EDITS_REQUIRED',
        'At least one edit is required',
      );
    }

    return trimmedEdits;
  }

  private applyGroundTruthCorrection(
    sample: DatasetSample,
    correctedGroundTruth: string,
  ): DatasetSample {
    if (sample.summary !== undefined) {
      return { ...sample, summary: correctedGroundTruth };
    }

    if (sample.class_label !== undefined) {
      return { ...sample, class_label: correctedGroundTruth };
    }

    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'GROUND_TRUTH_FIELD_MISSING',
      'Sample has no editable ground truth field',
      `Sample ${sample.sample_id ?? 'unknown'} has no summary or class label`,
    );
  }

  async editGroundTruth({
    datasetId,
    edits,
  }: EditGroundTruthInput): Promise<EditGroundTruthOutput> {
    const trimmedEdits = this.trimEdits(edits);

    const { content, fileExtension } =
      await this.datasetService.retrieveDataset(datasetId);

    if (fileExtension !== 'jsonl') {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'INVALID_FILE_FORMAT',
        'Dataset file must be in JSONL format for editing ground truth',
      );
    }

    const dataset: Dataset = this.jsonlParser.parse(content);

    const sampleIds = new Set(
      dataset.samples
        .map((sample) => sample.sample_id)
        .filter((id): id is string => id !== undefined),
    );

    for (const sampleId of Object.keys(trimmedEdits)) {
      if (!sampleIds.has(sampleId)) {
        throw new BasicError(
          BasicErrorType.NOT_FOUND,
          'SAMPLE_NOT_FOUND',
          'Sample not found',
          `No sample found with ID: ${sampleId}`,
        );
      }
    }

    const updatedSamples = dataset.samples.map((sample) => {
      const correction =
        sample.sample_id !== undefined
          ? trimmedEdits[sample.sample_id]
          : undefined;
      if (correction === undefined) return sample;
      return this.applyGroundTruthCorrection(sample, correction);
    });

    await this.datasetService.writeStructuredDataset(datasetId, updatedSamples);

    return { datasetId, edits: trimmedEdits };
  }
}

export const tokenEditGroundTruthUseCase =
  createInjectionToken<EditGroundTruthUseCase>('EditGroundTruthUseCase', {
    useClass: EditGroundTruthUseCaseImpl,
  });
