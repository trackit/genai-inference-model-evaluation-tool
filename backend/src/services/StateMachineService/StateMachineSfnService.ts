import {
  DescribeExecutionCommand,
  ExecutionStatus,
  GetExecutionHistoryCommand,
  SFNClient,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn';
import { createInjectionToken, inject } from '@trackit.io/di-container';

import {
  PreprocessingState,
  PreprocessingStatusReport,
} from '../../models/PreprocessingLifecycle';
import { StateMachineService } from '../../ports/StateMachineService';

export const STATE_BY_STATE_NAME: Record<string, PreprocessingState> = {
  DocumentConversion: PreprocessingState.DOCUMENT_PARSING,
  RunSyntheticPreprocessing: PreprocessingState.GENERATING_SYNTHETIC_OUTPUTS,
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

  async getPreprocessingStatus(
    executionArn: string,
  ): Promise<PreprocessingStatusReport> {
    const response = await this.sfnClient.send(
      new DescribeExecutionCommand({ executionArn }),
    );
    const status = response.status as ExecutionStatus;

    if (status === 'SUCCEEDED') {
      return this.completedReport(response.output);
    }

    if (status === 'RUNNING' || status === 'PENDING_REDRIVE') {
      const state = await this.resolveRunningState(executionArn);
      return { state: state ?? PreprocessingState.STARTING };
    }

    return { state: PreprocessingState.ERRORED };
  }

  private completedReport(output?: string): PreprocessingStatusReport {
    const parsed = output
      ? (JSON.parse(output) as Record<string, unknown>)
      : {};
    return {
      state: PreprocessingState.COMPLETED,
      structuredDatasetArtifactKey:
        typeof parsed.structuredDatasetArtifactKey === 'string'
          ? parsed.structuredDatasetArtifactKey
          : undefined,
      sampleCount:
        typeof parsed.sampleCount === 'number' ? parsed.sampleCount : undefined,
    };
  }

  private async resolveRunningState(
    executionArn: string,
  ): Promise<PreprocessingState | undefined> {
    try {
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
          if (name && name in STATE_BY_STATE_NAME) {
            return STATE_BY_STATE_NAME[name];
          }
        }

        nextToken = response.nextToken;
        if (!nextToken) break;
      }

      return undefined;
    } catch (error) {
      console.error(
        `Failed to resolve preprocessing state for ${executionArn}:`,
        error,
      );
      return undefined;
    }
  }
}

export const tokenClientSFN = createInjectionToken<SFNClient>('ClientSFN', {
  useClass: SFNClient,
});

export const tokenStateMachineService =
  createInjectionToken<StateMachineService>('StateMachineService', {
    useClass: StateMachineSfnService,
  });
