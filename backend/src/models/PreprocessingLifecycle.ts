export enum PreprocessingStage {
  DOCUMENT_PARSING = 'DOCUMENT_PARSING',
  GENERATING_SYNTHETIC_OUTPUTS = 'GENERATING_SYNTHETIC_OUTPUTS',
}

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
  sampleCount?: number;
}
