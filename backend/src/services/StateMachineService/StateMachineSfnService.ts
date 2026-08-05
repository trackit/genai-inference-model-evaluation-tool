import {
  DescribeExecutionCommand,
  GetExecutionHistoryCommand,
  SFNClient,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn';
import { createInjectionToken, inject } from '@trackit.io/di-container';

import { PreprocessingStage } from '../../models/Preprocessing';
import {
  ExecutionStatus,
  StateMachineService,
} from '../../ports/StateMachineService';

export const STAGE_BY_STATE_NAME: Record<string, PreprocessingStage> = {
  DocumentConversion: PreprocessingStage.DOCUMENT_PARSING,
  RunSyntheticPreprocessing: PreprocessingStage.GENERATING_SYNTHETIC_OUTPUTS,
};

const HISTORY_PAGE_SIZE = 100;

const MAX_HISTORY_PAGES = 20;

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

  async getCurrentPreprocessingStage(
    executionArn: string,
  ): Promise<PreprocessingStage | undefined> {
    let nextToken: string | undefined;

    for (let page = 0; page < MAX_HISTORY_PAGES; page += 1) {
      const response = await this.sfnClient.send(
        new GetExecutionHistoryCommand({
          executionArn,
          reverseOrder: true,
          maxResults: HISTORY_PAGE_SIZE,
          includeExecutionData: false,
          nextToken,
        }),
      );

      for (const event of response.events ?? []) {
        const name = event.stateEnteredEventDetails?.name;
        if (name && name in STAGE_BY_STATE_NAME) {
          return STAGE_BY_STATE_NAME[name];
        }
      }

      nextToken = response.nextToken;
      if (!nextToken) break;
    }

    return undefined;
  }
}

export const tokenClientSFN = createInjectionToken<SFNClient>('ClientSFN', {
  useClass: SFNClient,
});

export const tokenStateMachineService =
  createInjectionToken<StateMachineService>('StateMachineService', {
    useClass: StateMachineSfnService,
  });
