import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { DatasetSample } from '../../models/Dataset';
import {
  StructuredDatasetGenerationInput,
  StructuredDatasetGenerationOutput,
  SyntheticOutputRow,
} from '../../models/Preprocessing';
import { tokenStructuredDatasetWriter } from '../../services/StructuredDatasetWriter/StructuredDatasetWriter';
import { tokenSyntheticDatasetReader } from '../../services/SyntheticDatasetReader/SyntheticDatasetReader';

export type GenerateStructuredDatasetUseCase = {
  generateStructuredDataset(
    input: StructuredDatasetGenerationInput,
  ): Promise<StructuredDatasetGenerationOutput>;
};

export class GenerateStructuredDatasetUseCaseImpl implements GenerateStructuredDatasetUseCase {
  private readonly syntheticDatasetReader = inject(tokenSyntheticDatasetReader);
  private readonly structuredDatasetWriter = inject(
    tokenStructuredDatasetWriter,
  );

  async generateStructuredDataset({
    datasetId,
    syntheticDatasetArtifactKey,
  }: StructuredDatasetGenerationInput): Promise<StructuredDatasetGenerationOutput> {
    const syntheticRows = await this.syntheticDatasetReader.readSyntheticRows(
      syntheticDatasetArtifactKey,
    );
    const samples = syntheticRows.map(toDatasetSample);
    const { structuredDatasetArtifactKey } =
      await this.structuredDatasetWriter.writeStructuredDataset(
        datasetId,
        samples,
      );

    return {
      datasetId,
      structuredDatasetArtifactKey,
      sampleCount: samples.length,
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
  assertCompleted(row);

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

function assertCompleted(row: SyntheticOutputRow): void {
  if (row.status === 'completed') return;

  throw new BasicError(
    BasicErrorType.UNPROCESSABLE_ENTITY,
    'SYNTHETIC_OUTPUT_INCOMPLETE',
    'Synthetic dataset contains failed rows',
    `Chunk ${row.chunk_id} failed synthetic generation: ${
      row.error_message ?? 'Unknown error'
    }`,
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
