export enum PreprocessingState {
  STARTING = 'STARTING',
  DOCUMENT_PARSING = 'DOCUMENT_PARSING',
  GENERATING_SYNTHETIC_OUTPUTS = 'GENERATING_SYNTHETIC_OUTPUTS',
  COMPLETED = 'COMPLETED',
  ERRORED = 'ERRORED',
}

export interface PreprocessingStatusReport {
  state: PreprocessingState;
  structuredDatasetArtifactKey?: string;
  // When state === COMPLETED
  sampleCount?: number;
  failedCount?: number;
  // When state === GENERATING_SYNTHETIC_OUTPUTS
  processedCount?: number;
  totalCount?: number;
}
