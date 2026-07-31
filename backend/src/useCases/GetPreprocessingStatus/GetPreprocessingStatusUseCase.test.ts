import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it, vi } from 'vitest';

import {
  FakeStateMachineService,
  tokenFakeStateMachineService,
} from '../../services/StateMachineService/FakeStateMachineService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { GetPreprocessingStatusUseCaseImpl } from './GetPreprocessingStatusUseCase';

describe('GetPreprocessingStatusUseCase', () => {
  it('reports DOCUMENT_PARSING while the conversion state is running', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'RUNNING' };
    fakeStateMachine.enteredStateNamesByArn['arn:exec:1'] = [
      'DocumentConversion',
    ];

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({ status: 'RUNNING', stage: 'DOCUMENT_PARSING' });
  });

  it('reports GENERATING_SYNTHETIC_OUTPUTS while the synthetic state is running', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'RUNNING' };
    fakeStateMachine.enteredStateNamesByArn['arn:exec:1'] = [
      'RunSyntheticPreprocessing',
      'DocumentConversion',
    ];

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({
      status: 'RUNNING',
      stage: 'GENERATING_SYNTHETIC_OUTPUTS',
    });
  });

  it('omits the stage before any state has been entered', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'RUNNING' };
    fakeStateMachine.enteredStateNamesByArn['arn:exec:1'] = [];

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({ status: 'RUNNING' });
  });

  it('omits the stage when no entered state maps to a known stage', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'RUNNING' };
    fakeStateMachine.enteredStateNamesByArn['arn:exec:1'] = [
      'SomeRenamedState',
    ];

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({ status: 'RUNNING' });
  });

  it('reports the in-flight stage on failure, skipping the Fail state', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'FAILED' };
    fakeStateMachine.enteredStateNamesByArn['arn:exec:1'] = [
      'PreprocessingFailed',
      'DocumentConversion',
    ];

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({ status: 'FAILED', stage: 'DOCUMENT_PARSING' });
  });

  it('maps a timed out execution to FAILED with its stage', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'TIMED_OUT' };
    fakeStateMachine.enteredStateNamesByArn['arn:exec:1'] = [
      'RunSyntheticPreprocessing',
    ];

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({
      status: 'FAILED',
      stage: 'GENERATING_SYNTHETIC_OUTPUTS',
    });
  });

  it('returns the artifact details and no stage on success, without reading history', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = {
      status: 'SUCCEEDED',
      output: JSON.stringify({
        structuredDatasetArtifactKey: 'datasets/ds1/ds1.jsonl',
        sampleCount: 3,
      }),
    };
    const historySpy = vi.spyOn(fakeStateMachine, 'listEnteredStateNames');

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({
      status: 'SUCCEEDED',
      structuredDatasetArtifactKey: 'datasets/ds1/ds1.jsonl',
      sampleCount: 3,
    });
    expect(historySpy).not.toHaveBeenCalled();
  });

  it('still reports RUNNING when the history lookup fails', async () => {
    const { useCase, fakeStateMachine } = setup();
    fakeStateMachine.statusByArn['arn:exec:1'] = { status: 'RUNNING' };
    vi.spyOn(fakeStateMachine, 'listEnteredStateNames').mockRejectedValue(
      new Error('Throttled'),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await useCase.execute({ executionArn: 'arn:exec:1' });

    expect(result).toEqual({ status: 'RUNNING' });
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
