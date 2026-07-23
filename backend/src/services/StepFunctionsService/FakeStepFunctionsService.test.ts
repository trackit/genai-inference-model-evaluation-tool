import { describe, expect, it } from 'vitest';
import { FakeStepFunctionsService } from './FakeStepFunctionsService';

describe('FakeStepFunctionsService', () => {
  it('records started executions and returns a RUNNING status', async () => {
    const service = new FakeStepFunctionsService();
    const { executionArn } = await service.startExecution({
      name: 'ds-1',
      input: '{}',
    });

    expect(service.started).toEqual([{ name: 'ds-1', input: '{}' }]);
    expect((await service.describeExecution(executionArn)).status).toBe(
      'RUNNING',
    );
  });
});
