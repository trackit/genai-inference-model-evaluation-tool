import {
  DescribeExecutionCommand,
  GetExecutionHistoryCommand,
  SFNClient,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn';
import { createInjectionToken, inject } from '@trackit.io/di-container';
import {
  ExecutionStatus,
  StateMachineService,
} from '../../ports/StateMachineService';

export class StateMachineSfnService implements StateMachineService {
  private readonly stateMachineArn =
    process.env.PREPROCESSING_STATE_MACHINE_ARN!;
  private readonly sfnClient = inject(tokenClientSFN);

  async startExecution({
    name,
    input,
  }: {
    name: string;
    input: string;
  }): Promise<{ executionArn: string }> {
    const response = await this.sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: this.stateMachineArn,
        name,
        input,
      }),
    );
    return { executionArn: response.executionArn! };
  }

  async describeExecution(
    executionArn: string,
  ): Promise<{ status: ExecutionStatus; output?: string }> {
    const response = await this.sfnClient.send(
      new DescribeExecutionCommand({ executionArn }),
    );
    return {
      status: response.status as ExecutionStatus,
      output: response.output,
    };
  }

  async listEnteredStateNames({
    executionArn,
    limit,
  }: {
    executionArn: string;
    limit: number;
  }): Promise<string[]> {
    const response = await this.sfnClient.send(
      new GetExecutionHistoryCommand({
        executionArn,
        reverseOrder: true,
        maxResults: limit,
        includeExecutionData: false,
      }),
    );

    return (response.events ?? [])
      .map((event) => event.stateEnteredEventDetails?.name)
      .filter((name): name is string => typeof name === 'string');
  }
}

export const tokenClientSFN = createInjectionToken<SFNClient>('ClientSFN', {
  useClass: SFNClient,
});

export const tokenStateMachineService =
  createInjectionToken<StateMachineService>('StateMachineService', {
    useClass: StateMachineSfnService,
  });
