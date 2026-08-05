import { createInjectionToken } from '@trackit.io/di-container';

import { PreprocessingStage } from '../../models/Preprocessing';
import {
  ExecutionStatus,
  StateMachineService,
} from '../../ports/StateMachineService';

export class FakeStateMachineService implements StateMachineService {
  public readonly started: Array<{ name: string; input: string }> = [];
  public statusByArn: Record<
    string,
    { status: ExecutionStatus; output?: string }
  > = {};
  public stageByArn: Record<string, PreprocessingStage | undefined> = {};
  private counter = 0;

  async startExecution({
    name,
    input,
  }: {
    name: string;
    input: string;
  }): Promise<{ executionArn: string }> {
    this.started.push({ name, input });
    const executionArn = `arn:aws:states:local:0:execution:sm:${name}-${this.counter++}`;
    this.statusByArn[executionArn] = { status: 'RUNNING' };
    return { executionArn };
  }

  async describeExecution(
    executionArn: string,
  ): Promise<{ status: ExecutionStatus; output?: string }> {
    return this.statusByArn[executionArn] ?? { status: 'RUNNING' };
  }

  async getCurrentPreprocessingStage(
    executionArn: string,
  ): Promise<PreprocessingStage | undefined> {
    return this.stageByArn[executionArn];
  }
}

export const tokenFakeStateMachineService =
  createInjectionToken<FakeStateMachineService>('FakeStateMachineService', {
    useClass: FakeStateMachineService,
  });
