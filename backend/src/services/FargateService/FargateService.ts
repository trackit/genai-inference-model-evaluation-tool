import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { createInjectionToken, inject } from '@trackit.io/di-container';
import { TaskService } from '../../ports/TaskService';

export class FargateServiceImpl implements TaskService {
  private readonly clusterName = process.env.ECS_CLUSTER!;
  private readonly taskDefinition = process.env.TASK_DEFINITION!;
  private readonly subnetId = process.env.SUBNET_ID!;
  private readonly securityGroupId = process.env.SECURITY_GROUP_ID!;
  private readonly ecsClient = inject(tokenClientECS);

  async launchTask(evaluationId: string): Promise<void> {
    try {
      await this.ecsClient.send(
        new RunTaskCommand({
          cluster: this.clusterName,
          taskDefinition: this.taskDefinition,
          launchType: 'FARGATE',
          networkConfiguration: {
            awsvpcConfiguration: {
              assignPublicIp: 'ENABLED',
              subnets: [this.subnetId],
              securityGroups: [this.securityGroupId],
            },
          },
          overrides: {
            containerOverrides: [
              {
                name: 'evaluation-engine',
                environment: [{ name: 'EVALUATION_ID', value: evaluationId }],
              },
            ],
          },
        }),
      );
    } catch (error) {
      throw new Error(
        `Failed to launch Fargate task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

export const tokenClientECS = createInjectionToken<ECSClient>('ClientECS', {
  useClass: ECSClient,
});

export const tokenFargateService = createInjectionToken<TaskService>(
  'FargateService',
  { useClass: FargateServiceImpl },
);
