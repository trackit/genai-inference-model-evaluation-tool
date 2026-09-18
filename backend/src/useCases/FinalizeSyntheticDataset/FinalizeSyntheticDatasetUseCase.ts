import { createInjectionToken, inject } from '@trackit.io/di-container';

import { SyntheticOutputRow } from '../../models/SyntheticOutput';
import { tokenDatasetService } from '../../services/DatasetService/DatasetServiceS3';
import { tokenGenerateStructuredDatasetUseCase } from '../GenerateStructuredDataset/GenerateStructuredDatasetUseCase';

/**
 * Shape of a Step Functions Distributed Map ResultWriter manifest.json.
 * https://docs.aws.amazon.com/step-functions/latest/dg/input-output-resultwriter.html
 * If Step Functions changes the manifest format, check that page before editing this interface.
 */
interface ResultWriterManifest {
  ResultFiles: {
    SUCCEEDED: Array<{ Key: string; Size: number }>;
    FAILED: Array<{ Key: string; Size: number }>;
    PENDING: Array<{ Key: string; Size: number }>;
  };
}

export interface FinalizeSyntheticDatasetInput {
  datasetId: string;
  manifestKey: string;
}

export interface FinalizeSyntheticDatasetResult {
  datasetId: string;
  syntheticDatasetArtifactKey: string;
  structuredDatasetArtifactKey: string;
  failedCount: number;
  sampleCount: number;
}

export type FinalizeSyntheticDatasetUseCase = {
  execute(
    input: FinalizeSyntheticDatasetInput,
  ): Promise<FinalizeSyntheticDatasetResult>;
};

export class FinalizeSyntheticDatasetUseCaseImpl implements FinalizeSyntheticDatasetUseCase {
  private readonly datasetService = inject(tokenDatasetService);
  private readonly generateStructuredDataset = inject(
    tokenGenerateStructuredDatasetUseCase,
  );

  async execute({
    datasetId,
    manifestKey,
  }: FinalizeSyntheticDatasetInput): Promise<FinalizeSyntheticDatasetResult> {
    const manifest = await this.readManifest(manifestKey);

    const infraFailedCount =
      manifest.ResultFiles.FAILED.length + manifest.ResultFiles.PENDING.length;

    const rows = await this.readAllSucceededRows(manifest);

    const { syntheticDatasetArtifactKey } =
      await this.datasetService.writeSyntheticDataset(datasetId, rows);

    const { structuredDatasetArtifactKey, sampleCount, failedCount } =
      await this.generateStructuredDataset.generateStructuredDataset({
        datasetId,
        syntheticDatasetArtifactKey,
      });

    return {
      datasetId,
      syntheticDatasetArtifactKey,
      structuredDatasetArtifactKey,
      failedCount: failedCount + infraFailedCount,
      sampleCount,
    };
  }

  private async readManifest(
    manifestKey: string,
  ): Promise<ResultWriterManifest> {
    const content = await this.datasetService.readRawObject(manifestKey);
    return JSON.parse(content) as ResultWriterManifest;
  }

  private async readAllSucceededRows(
    manifest: ResultWriterManifest,
  ): Promise<SyntheticOutputRow[]> {
    const rows: SyntheticOutputRow[] = [];

    for (const file of manifest.ResultFiles.SUCCEEDED) {
      const content = await this.datasetService.readRawObject(file.Key);

      const lines = content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        rows.push(JSON.parse(line) as SyntheticOutputRow);
      }
    }

    return rows;
  }
}

export const tokenFinalizeSyntheticDatasetUseCase =
  createInjectionToken<FinalizeSyntheticDatasetUseCase>(
    'FinalizeSyntheticDatasetUseCase',
    {
      useClass: FinalizeSyntheticDatasetUseCaseImpl,
    },
  );
