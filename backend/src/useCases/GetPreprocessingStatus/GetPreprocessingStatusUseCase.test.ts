import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it, vi } from 'vitest';

import { PreprocessingStage } from '../../models/Preprocessing';
import {
  FakeStateMachineService,
  tokenFakeStateMachineService,
} from '../../services/StateMachineService/FakeStateMachineService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { GetPreprocessingStatusUseCaseImpl } from './GetPreprocessingStatusUseCase';

describe('GetPreprocessingStatusUseCase', () => {
  it('reports DOCUMENT_PARSING while the conversion stage is running', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'RUNNING' };
    fakeStateMachine.stageByArn['arn:exec:1'] =
      PreprocessingStage.DOCUMENT_PARSING;

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({ state: 'DOCUMENT_PARSING' });
  });

  it('reports GENERATING_SYNTHETIC_OUTPUTS while the synthetic stage is running', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'RUNNING' };
    fakeStateMachine.stageByArn['arn:exec:1'] =
      PreprocessingStage.GENERATING_SYNTHETIC_OUTPUTS;

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({ state: 'GENERATING_SYNTHETIC_OUTPUTS' });
  });

  it('reports STARTING before any known stage has been entered', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'RUNNING' };
    fakeStateMachine.stageByArn['arn:exec:1'] = undefined;

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({ state: 'STARTING' });
  });

  it('reports ERRORED on failure without reading history', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'FAILED' };
    const stageSpy = vi.spyOn(fakeStateMachine, 'getCurrentPreprocessingStage');

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({ state: 'ERRORED' });
    expect(stageSpy).not.toHaveBeenCalled();
  });

  it('maps a timed out execution to ERRORED', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'TIMED_OUT' };

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({ state: 'ERRORED' });
  });

  it('maps an aborted execution to ERRORED', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'ABORTED' };

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({ state: 'ERRORED' });
  });

  it('returns COMPLETED with the artifact details on success, without reading history', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = {
      status: 'SUCCEEDED',
      output: JSON.stringify({
        structuredDatasetArtifactKey: 'datasets/ds1/ds1.jsonl',
        sampleCount: 3,
      }),
    };
    const stageSpy = vi.spyOn(fakeStateMachine, 'getCurrentPreprocessingStage');

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({
      state: 'COMPLETED',
      structuredDatasetArtifactKey: 'datasets/ds1/ds1.jsonl',
      sampleCount: 3,
    });
    expect(stageSpy).not.toHaveBeenCalled();
  });

  it('degrades to STARTING when the stage lookup fails', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'RUNNING' };
    vi.spyOn(
      fakeStateMachine,
      'getCurrentPreprocessingStage',
    ).mockRejectedValue(new Error('Throttled'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({ state: 'STARTING' });
    expect(consoleSpy).toHaveBeenCalled();
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
