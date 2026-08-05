import { ExecutionStatus } from '@aws-sdk/client-sfn';

import { PreprocessingStage } from '../models/Preprocessing';

export type { ExecutionStatus };

export interface StateMachineService {
  startExecution(input: {
    name: string;
    input: string;
  }): Promise<{ executionArn: string }>;

  describeExecution(
    executionArn: string,
  ): Promise<{ status: ExecutionStatus; output?: string }>;

  getCurrentPreprocessingStage(
    executionArn: string,
  ): Promise<PreprocessingStage | undefined>;
}
