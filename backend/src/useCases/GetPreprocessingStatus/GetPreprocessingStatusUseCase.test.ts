import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';

import { PreprocessingState } from '../../models/PreprocessingLifecycle';
import {
  FakeStateMachineService,
  tokenFakeStateMachineService,
} from '../../services/StateMachineService/FakeStateMachineService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { GetPreprocessingStatusUseCaseImpl } from './GetPreprocessingStatusUseCase';

describe('GetPreprocessingStatusUseCase', () => {
  it('returns the preprocessing status report for the execution', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.reportByArn['arn:exec:1'] = {
      state: PreprocessingState.COMPLETED,
      structuredDatasetArtifactKey: 'datasets/ds1/ds1.jsonl',
      sampleCount: 3,
    };

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({
      state: 'COMPLETED',
      structuredDatasetArtifactKey: 'datasets/ds1/ds1.jsonl',
      sampleCount: 3,
    });
  });
});

const setup = () => {
  reset();
  registerTestInfrastructure();

  const fakeStateMachine: FakeStateMachineService = inject(
    tokenFakeStateMachineService,
  );

  return {
    useCase: new GetPreprocessingStatusUseCaseImpl(),
    fakeStateMachine,
  };
};
