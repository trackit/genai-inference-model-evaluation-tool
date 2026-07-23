export type ExecutionStatus =
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'ABORTED'
  | 'PENDING_REDRIVE';

export interface StepFunctionsService {
  startExecution(input: {
    name: string;
    input: string;
  }): Promise<{ executionArn: string }>;

  describeExecution(
    executionArn: string,
  ): Promise<{ status: ExecutionStatus; output?: string }>;
}
