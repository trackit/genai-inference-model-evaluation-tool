import { createInjectionToken, inject } from '@trackit.io/di-container';

import {
  PreprocessingStage,
  PreprocessingState,
} from '../../models/Preprocessing';
import { tokenStateMachineService } from '../../services/StateMachineService/StateMachineSfnService';

const STATE_BY_STAGE: Record<PreprocessingStage, PreprocessingState> = {
  [PreprocessingStage.DOCUMENT_PARSING]: PreprocessingState.DOCUMENT_PARSING,
  [PreprocessingStage.GENERATING_SYNTHETIC_OUTPUTS]:
    PreprocessingState.GENERATING_SYNTHETIC_OUTPUTS,
};

export interface GetPreprocessingStatusResult {
  state: PreprocessingState;
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
        state: PreprocessingState.COMPLETED,
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

    if (status === 'RUNNING' || status === 'PENDING_REDRIVE') {
      const stage = await this.resolveStage(executionArn);
      return {
        state: stage ? STATE_BY_STAGE[stage] : PreprocessingState.STARTING,
      };
    }

    return { state: PreprocessingState.ERRORED };
  }

  private async resolveStage(
    executionArn: string,
  ): Promise<PreprocessingStage | undefined> {
    try {
      return await this.stateMachine.getCurrentPreprocessingStage(executionArn);
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
