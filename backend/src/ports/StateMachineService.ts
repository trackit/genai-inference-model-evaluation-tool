import { PreprocessingStatusReport } from '../models/PreprocessingLifecycle';

export interface MapRunItemCounts {
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
  aborted: number;
  timedOut: number;
  total: number;
}

export interface StateMachineService {
  startExecution(input: {
    name: string;
    input: string;
  }): Promise<{ executionArn: string }>;

  getPreprocessingStatus(
    executionArn: string,
  ): Promise<PreprocessingStatusReport>;

  /**
   * Returns the item-level counts for the active Map Run started by the given
   * execution, or undefined if no Map Run exists yet (e.g. the execution is
   * still in the DocumentConversion step before the Map starts).
   */
  getMapRunItemCounts(
    executionArn: string,
  ): Promise<MapRunItemCounts | undefined>;
}
