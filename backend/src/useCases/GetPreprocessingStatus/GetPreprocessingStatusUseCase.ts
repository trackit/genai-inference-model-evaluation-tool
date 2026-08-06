import { createInjectionToken, inject } from '@trackit.io/di-container';

import { PreprocessingStatusReport } from '../../models/PreprocessingLifecycle';
import { tokenStateMachineService } from '../../services/StateMachineService/StateMachineSfnService';

export type PreprocessingStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface GetPreprocessingStatusResult {
  status: PreprocessingStatus;
  structuredDatasetArtifactKey?: string;
  // When status === 'SUCCEEDED'
  sampleCount?: number;
  failedCount?: number;
  // When status === 'RUNNING'
  processedCount?: number;
  totalCount?: number;
}

export type GetPreprocessingStatusUseCase = {
  execute(input: { executionArn: string }): Promise<PreprocessingStatusReport>;
};

export class GetPreprocessingStatusUseCaseImpl implements GetPreprocessingStatusUseCase {
  private readonly stateMachine = inject(tokenStateMachineService);

  async execute({
    executionArn,
  }: {
    executionArn: string;
  }): Promise<PreprocessingStatusReport> {
    return this.stateMachine.getPreprocessingStatus(executionArn);
  }
}

export const tokenGetPreprocessingStatusUseCase =
  createInjectionToken<GetPreprocessingStatusUseCase>(
    'GetPreprocessingStatusUseCase',
    { useClass: GetPreprocessingStatusUseCaseImpl },
  );
