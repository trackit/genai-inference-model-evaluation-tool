import { createInjectionToken } from '@trackit.io/di-container';
import {
  ExecutionStatus,
  StepFunctionsService,
} from '../../ports/StepFunctionsService';

export class FakeStepFunctionsService implements StepFunctionsService {
  public readonly started: Array<{ name: string; input: string }> = [];
  public statusByArn: Record<
    string,
    { status: ExecutionStatus; output?: string }
  > = {};
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
}

export const tokenFakeStepFunctionsService =
  createInjectionToken<FakeStepFunctionsService>('FakeStepFunctionsService', {
    useClass: FakeStepFunctionsService,
  });
