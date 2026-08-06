import { createInjectionToken, inject } from '@trackit.io/di-container';

import { PreprocessingStatusReport } from '../../models/PreprocessingLifecycle';
import { tokenStateMachineService } from '../../services/StateMachineService/StateMachineSfnService';

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
