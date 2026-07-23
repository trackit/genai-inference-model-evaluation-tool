import {
  DescribeExecutionCommand,
  SFNClient,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn';
import { createInjectionToken, inject } from '@trackit.io/di-container';
import {
  ExecutionStatus,
  StepFunctionsService,
} from '../../ports/StepFunctionsService';

export class StepFunctionsServiceImpl implements StepFunctionsService {
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
}

export const tokenClientSFN = createInjectionToken<SFNClient>('ClientSFN', {
  useClass: SFNClient,
});

export const tokenStepFunctionsService =
  createInjectionToken<StepFunctionsService>('StepFunctionsService', {
    useClass: StepFunctionsServiceImpl,
  });
