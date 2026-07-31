import { createInjectionToken, inject } from '@trackit.io/di-container';

import { tokenStateMachineService } from '../../services/StateMachineService/StateMachineSfnService';

export type PreprocessingStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export type PreprocessingStage =
  | 'DOCUMENT_PARSING'
  | 'GENERATING_SYNTHETIC_OUTPUTS';

export const STAGE_BY_STATE_NAME: Record<string, PreprocessingStage> = {
  DocumentConversion: 'DOCUMENT_PARSING',
  RunSyntheticPreprocessing: 'GENERATING_SYNTHETIC_OUTPUTS',
};

const HISTORY_PAGE_SIZE = 25;

export interface GetPreprocessingStatusResult {
  status: PreprocessingStatus;
  stage?: PreprocessingStage;
  structuredDatasetArtifactKey?: string;
  sampleCount?: number;
}

export type GetPreprocessingStatusUseCase = {
  execute(input: {
    executionArn: string;
  }): Promise<GetPreprocessingStatusResult>;
};

export class GetPreprocessingStatusUseCaseImpl implements GetPreprocessingStatusUseCase {
  private readonly stateMachine = inject(tokenStateMachineService);

  async execute({
    executionArn,
  }: {
    executionArn: string;
  }): Promise<GetPreprocessingStatusResult> {
    const { status, output } =
      await this.stateMachine.describeExecution(executionArn);

    if (status === 'SUCCEEDED') {
      const parsed = output
        ? (JSON.parse(output) as Record<string, unknown>)
        : {};
      return {
        status: 'SUCCEEDED',
        structuredDatasetArtifactKey:
          typeof parsed.structuredDatasetArtifactKey === 'string'
            ? parsed.structuredDatasetArtifactKey
            : undefined,
        sampleCount:
          typeof parsed.sampleCount === 'number'
            ? parsed.sampleCount
            : undefined,
      };
    }

    const stage = await this.resolveStage(executionArn);

    if (status === 'RUNNING') {
      return stage ? { status: 'RUNNING', stage } : { status: 'RUNNING' };
    }

    return stage ? { status: 'FAILED', stage } : { status: 'FAILED' };
  }

  private async resolveStage(
    executionArn: string,
  ): Promise<PreprocessingStage | undefined> {
    try {
      const enteredStateNames = await this.stateMachine.listEnteredStateNames({
        executionArn,
        limit: HISTORY_PAGE_SIZE,
      });

      return enteredStateNames
        .map((name) => STAGE_BY_STATE_NAME[name])
        .find((stage): stage is PreprocessingStage => stage !== undefined);
    } catch (error) {
      console.error(
        `Failed to resolve preprocessing stage for ${executionArn}:`,
        error,
      );
      return undefined;
    }
  }
}

export const tokenGetPreprocessingStatusUseCase =
  createInjectionToken<GetPreprocessingStatusUseCase>(
    'GetPreprocessingStatusUseCase',
    { useClass: GetPreprocessingStatusUseCaseImpl },
  );
