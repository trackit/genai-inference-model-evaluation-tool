export type ExecutionStatus =
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'ABORTED'
  | 'PENDING_REDRIVE';

export interface StateMachineService {
  startExecution(input: {
    name: string;
    input: string;
  }): Promise<{ executionArn: string }>;

  describeExecution(
    executionArn: string,
  ): Promise<{ status: ExecutionStatus; output?: string }>;

  listEnteredStateNames(input: {
    executionArn: string;
    limit: number;
  }): Promise<string[]>;
}
