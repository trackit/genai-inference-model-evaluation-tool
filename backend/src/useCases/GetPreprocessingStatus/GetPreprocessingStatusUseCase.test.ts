import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';

import { structuredDatasetS3Key } from 'backend/src/services/DatasetService/DatasetServiceS3';
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
      structuredDatasetArtifactKey: structuredDatasetS3Key('ds1'),
      sampleCount: 3,
    };

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({
      state: 'COMPLETED',
      structuredDatasetArtifactKey: structuredDatasetS3Key('ds1'),
      sampleCount: 3,
    });
  });

  it('passes through failedCount on a partially-successful completed run', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.reportByArn['arn:exec:1'] = {
      state: PreprocessingState.COMPLETED,
      structuredDatasetArtifactKey: structuredDatasetS3Key('ds1'),
      sampleCount: 8,
      failedCount: 2,
    };

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toMatchObject({ sampleCount: 8, failedCount: 2 });
  });

  it('passes through processedCount/totalCount while generating synthetic outputs', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.reportByArn['arn:exec:1'] = {
      state: PreprocessingState.GENERATING_SYNTHETIC_OUTPUTS,
      processedCount: 3,
      totalCount: 10,
    };

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toMatchObject({
      state: 'GENERATING_SYNTHETIC_OUTPUTS',
      processedCount: 3,
      totalCount: 10,
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
