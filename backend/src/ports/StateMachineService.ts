import { PreprocessingStatusReport } from '../models/PreprocessingLifecycle';

export interface StateMachineService {
  startExecution(input: {
    name: string;
    input: string;
  }): Promise<{ executionArn: string }>;

  getPreprocessingStatus(
    executionArn: string,
  ): Promise<PreprocessingStatusReport>;
}
