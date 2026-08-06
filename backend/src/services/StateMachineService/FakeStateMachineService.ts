import { createInjectionToken } from '@trackit.io/di-container';

import {
  PreprocessingState,
  PreprocessingStatusReport,
} from '../../models/PreprocessingLifecycle';
import { StateMachineService } from '../../ports/StateMachineService';

export class FakeStateMachineService implements StateMachineService {
  public readonly started: Array<{ name: string; input: string }> = [];
  public reportByArn: Record<string, PreprocessingStatusReport> = {};
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
    return { executionArn };
  }

  async getPreprocessingStatus(
    executionArn: string,
  ): Promise<PreprocessingStatusReport> {
    return (
      this.reportByArn[executionArn] ?? { state: PreprocessingState.STARTING }
    );
  }
}

export const tokenFakeStateMachineService =
  createInjectionToken<FakeStateMachineService>('FakeStateMachineService', {
    useClass: FakeStateMachineService,
  });
