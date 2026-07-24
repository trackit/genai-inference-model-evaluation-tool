import { createInjectionToken, inject } from '@trackit.io/di-container';

import { ChunkingStrategy } from '../../models/DocumentConversion';
import { SyntheticOutputTaskType } from '../../models/SyntheticOutput';
import { tokenStateMachineService } from '../../services/StateMachineService/StateMachineSfnService';

export interface StartPreprocessingInput {
  datasetId: string;
  taskType: SyntheticOutputTaskType;
  chunkingStrategy: ChunkingStrategy;
}

export interface StartPreprocessingResult {
  executionArn: string;
  status: 'RUNNING';
}

export type StartPreprocessingUseCase = {
  execute(input: StartPreprocessingInput): Promise<StartPreprocessingResult>;
};

export class StartPreprocessingUseCaseImpl implements StartPreprocessingUseCase {
  private readonly stateMachine = inject(tokenStateMachineService);

  async execute({
    datasetId,
    taskType,
    chunkingStrategy,
  }: StartPreprocessingInput): Promise<StartPreprocessingResult> {
    const name = `${datasetId}-${Date.now()}`;
    const input = JSON.stringify({ datasetId, taskType, chunkingStrategy });

    const { executionArn } = await this.stateMachine.startExecution({
      name,
      input,
    });

    return { executionArn, status: 'RUNNING' };
  }
}

export const tokenStartPreprocessingUseCase =
  createInjectionToken<StartPreprocessingUseCase>('StartPreprocessingUseCase', {
    useClass: StartPreprocessingUseCaseImpl,
  });
