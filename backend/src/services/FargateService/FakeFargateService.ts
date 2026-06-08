import { createInjectionToken } from '@trackit.io/di-container';
import { TaskService } from '../../ports/TaskService';

export class FakeFargateService implements TaskService {
  public readonly launchedEvaluationIds: string[] = [];

  async launchTask(evaluationId: string): Promise<void> {
    this.launchedEvaluationIds.push(evaluationId);
  }
}

export const tokenFakeFargateService = createInjectionToken<FakeFargateService>(
  'FakeFargateService',
  { useClass: FakeFargateService },
);
