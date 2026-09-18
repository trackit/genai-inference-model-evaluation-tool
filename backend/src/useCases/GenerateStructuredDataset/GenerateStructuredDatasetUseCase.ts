import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { DatasetSample } from '../../models/Dataset';
import { SyntheticOutputRow } from '../../models/SyntheticOutput';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';

export interface StructuredDatasetGenerationInput {
  datasetId: string;
  syntheticDatasetArtifactKey: string;
}

export interface StructuredDatasetGenerationOutput {
  datasetId: string;
  structuredDatasetArtifactKey: string;
  sampleCount: number;
  failedCount: number;
}

export type GenerateStructuredDatasetUseCase = {
  generateStructuredDataset(
    input: StructuredDatasetGenerationInput,
  ): Promise<StructuredDatasetGenerationOutput>;
};

export class GenerateStructuredDatasetUseCaseImpl implements GenerateStructuredDatasetUseCase {
  private readonly datasetService = inject(tokenDatasetService);

  async generateStructuredDataset({
    datasetId,
    syntheticDatasetArtifactKey,
  }: StructuredDatasetGenerationInput): Promise<StructuredDatasetGenerationOutput> {
    const syntheticRows = await this.datasetService.readSyntheticDatasetRows(
      syntheticDatasetArtifactKey,
    );

    const completedRows = syntheticRows.filter(
      (row) => row.status === 'completed',
    );
    const failedCount = syntheticRows.length - completedRows.length;

    if (completedRows.length === 0) {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'SYNTHETIC_GENERATION_ALL_FAILED',
        'All rows failed synthetic generation',
        `${syntheticRows.length} row(s) all failed; no structured dataset could be produced`,
      );
    }

    const samples = completedRows.map(toDatasetSample);
    const { structuredDatasetArtifactKey } =
      await this.datasetService.writeStructuredDataset(datasetId, samples);

    return {
      datasetId,
      structuredDatasetArtifactKey,
      sampleCount: samples.length,
      failedCount,
    };
  }
}

export const tokenGenerateStructuredDatasetUseCase =
  createInjectionToken<GenerateStructuredDatasetUseCase>(
    'GenerateStructuredDatasetUseCase',
    {
      useClass: GenerateStructuredDatasetUseCaseImpl,
    },
  );

function toDatasetSample(row: SyntheticOutputRow): DatasetSample {
  if (row.summary !== undefined) {
    if (!row.summary.trim()) {
      throw incompleteSyntheticOutput(row, 'summary');
    }

    return {
      document: row.text,
      summary: row.summary,
    };
  }

  if (row.class !== undefined) {
    if (!row.class.trim()) {
      throw incompleteSyntheticOutput(row, 'class');
    }

    return {
      document: row.text,
      class_label: row.class,
    };
  }

  throw new BasicError(
    BasicErrorType.UNPROCESSABLE_ENTITY,
    'SYNTHETIC_OUTPUT_FIELD_MISSING',
    'Synthetic row must include summary or class',
    `Chunk ${row.chunk_id} has no generated output field`,
  );
}

function incompleteSyntheticOutput(
  row: SyntheticOutputRow,
  field: 'summary' | 'class',
): BasicError {
  return new BasicError(
    BasicErrorType.UNPROCESSABLE_ENTITY,
    'SYNTHETIC_OUTPUT_INCOMPLETE',
    `Synthetic ${field} cannot be empty`,
    `Chunk ${row.chunk_id} has an empty ${field}`,
  );
}
