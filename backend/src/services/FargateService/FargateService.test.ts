import { RunTaskCommand } from '@aws-sdk/client-ecs';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { FargateServiceImpl, tokenClientECS } from './FargateService';

describe('FargateService', () => {
  describe('launchTask', () => {
    it('should launch a Fargate task with the evaluation id in container env', async () => {
      const { service, ecsClientMock } = setup();

      ecsClientMock.on(RunTaskCommand).resolves({});

      await service.launchTask('eval-123');

      const runTaskCalls = ecsClientMock.commandCalls(RunTaskCommand);
      expect(runTaskCalls).toHaveLength(1);
      expect(runTaskCalls[0].args[0].input).toEqual({
        cluster: 'test-cluster',
        taskDefinition: 'test-task-def',
        launchType: 'FARGATE',
        networkConfiguration: {
          awsvpcConfiguration: {
            assignPublicIp: 'ENABLED',
            subnets: ['subnet-abc'],
            securityGroups: ['sg-xyz'],
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: 'evaluation-engine',
              environment: [{ name: 'EVALUATION_ID', value: 'eval-123' }],
            },
          ],
        },
      });
    });

    it('should wrap ECS client failures in a descriptive error', async () => {
      const { service, ecsClientMock } = setup();
      ecsClientMock
        .on(RunTaskCommand)
        .rejects(new Error('ECS capacity unavailable'));

      await expect(service.launchTask('eval-456')).rejects.toThrow(
        'Failed to launch Fargate task: ECS capacity unavailable',
      );
    });
  });
});

const setup = () => {
  reset();
  registerTestInfrastructure();

  process.env.ECS_CLUSTER = 'test-cluster';
  process.env.TASK_DEFINITION = 'test-task-def';
  process.env.SUBNET_ID = 'subnet-abc';
  process.env.SECURITY_GROUP_ID = 'sg-xyz';

  const ecsClientMock = mockClient(inject(tokenClientECS));

  return {
    service: new FargateServiceImpl(),
    ecsClientMock,
  };
};
