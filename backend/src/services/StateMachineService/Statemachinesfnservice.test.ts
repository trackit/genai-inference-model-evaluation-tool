import {
  DescribeExecutionCommand,
  DescribeMapRunCommand,
  GetExecutionHistoryCommand,
  ListMapRunsCommand,
} from '@aws-sdk/client-sfn';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import { PreprocessingState } from '../../models/PreprocessingLifecycle';
import {
  StateMachineSfnService,
  tokenClientSFN,
} from './StateMachineSfnService';

describe('StateMachineSfnService', () => {
  beforeEach(() => {
    reset();
  });

  function setup() {
    const sfnMock = mockClient(inject(tokenClientSFN));
    return { service: new StateMachineSfnService(), sfnMock };
  }

  describe('getPreprocessingStatus', () => {
    it('returns COMPLETED with structuredDatasetArtifactKey, sampleCount, and failedCount from the execution output', async () => {
      const { service, sfnMock } = setup();
      sfnMock.on(DescribeExecutionCommand).resolves({
        status: 'SUCCEEDED',
        output: JSON.stringify({
          structuredDatasetArtifactKey: 'datasets/ds1/ds1.jsonl',
          sampleCount: 8,
          failedCount: 2,
        }),
      });

      const result = await service.getPreprocessingStatus('arn:exec:1');

      expect(result).toEqual({
        state: PreprocessingState.COMPLETED,
        structuredDatasetArtifactKey: 'datasets/ds1/ds1.jsonl',
        sampleCount: 8,
        failedCount: 2,
      });
    });

    it('resolves DOCUMENT_PARSING from execution history while running', async () => {
      const { service, sfnMock } = setup();
      sfnMock.on(DescribeExecutionCommand).resolves({ status: 'RUNNING' });
      sfnMock.on(GetExecutionHistoryCommand).resolves({
        events: [{ stateEnteredEventDetails: { name: 'DocumentConversion' } }],
      });

      const result = await service.getPreprocessingStatus('arn:exec:1');

      expect(result).toEqual({ state: PreprocessingState.DOCUMENT_PARSING });
    });

    it('resolves GENERATING_SYNTHETIC_OUTPUTS and attaches live item counts from the Distributed Map', async () => {
      const { service, sfnMock } = setup();
      sfnMock.on(DescribeExecutionCommand).resolves({ status: 'RUNNING' });
      sfnMock.on(GetExecutionHistoryCommand).resolves({
        events: [
          {
            stateEnteredEventDetails: { name: 'SyntheticOutputsGeneration' },
          },
        ],
      });
      sfnMock
        .on(ListMapRunsCommand)
        .resolves({ mapRuns: [{ mapRunArn: 'arn:mapRun:1' }] });
      sfnMock.on(DescribeMapRunCommand).resolves({
        itemCounts: {
          pending: 2,
          running: 1,
          succeeded: 5,
          failed: 1,
          aborted: 0,
          timedOut: 0,
          total: 9,
        },
      });

      const result = await service.getPreprocessingStatus('arn:exec:1');

      expect(result).toEqual({
        state: PreprocessingState.GENERATING_SYNTHETIC_OUTPUTS,
        // succeeded(5) + failed(1) + aborted(0) + timedOut(0) = 6 "done"
        processedCount: 6,
        totalCount: 9,
      });
    });

    it('falls back to just the state when no Map Run exists yet', async () => {
      const { service, sfnMock } = setup();
      sfnMock.on(DescribeExecutionCommand).resolves({ status: 'RUNNING' });
      sfnMock.on(GetExecutionHistoryCommand).resolves({
        events: [
          {
            stateEnteredEventDetails: { name: 'SyntheticOutputsGeneration' },
          },
        ],
      });
      sfnMock.on(ListMapRunsCommand).resolves({ mapRuns: [] });

      const result = await service.getPreprocessingStatus('arn:exec:1');

      expect(result).toEqual({
        state: PreprocessingState.GENERATING_SYNTHETIC_OUTPUTS,
      });
    });

    it('returns STARTING when no known state has been entered yet', async () => {
      const { service, sfnMock } = setup();
      sfnMock.on(DescribeExecutionCommand).resolves({ status: 'RUNNING' });
      sfnMock.on(GetExecutionHistoryCommand).resolves({ events: [] });

      const result = await service.getPreprocessingStatus('arn:exec:1');

      expect(result).toEqual({ state: PreprocessingState.STARTING });
    });

    it.each(['FAILED', 'TIMED_OUT', 'ABORTED'] as const)(
      'returns ERRORED for a %s execution',
      async (status) => {
        const { service, sfnMock } = setup();
        sfnMock.on(DescribeExecutionCommand).resolves({ status });

        const result = await service.getPreprocessingStatus('arn:exec:1');

        expect(result).toEqual({ state: PreprocessingState.ERRORED });
      },
    );
  });

  describe('getMapRunItemCounts', () => {
    it('returns undefined when the execution has not started a Map Run', async () => {
      const { service, sfnMock } = setup();
      sfnMock.on(ListMapRunsCommand).resolves({ mapRuns: [] });

      const result = await service.getMapRunItemCounts('arn:exec:1');

      expect(result).toBeUndefined();
    });

    it('maps DescribeMapRun item counts to the port shape', async () => {
      const { service, sfnMock } = setup();
      sfnMock
        .on(ListMapRunsCommand)
        .resolves({ mapRuns: [{ mapRunArn: 'arn:mapRun:1' }] });
      sfnMock.on(DescribeMapRunCommand).resolves({
        itemCounts: {
          pending: 1,
          running: 2,
          succeeded: 3,
          failed: 4,
          aborted: 5,
          timedOut: 6,
          total: 21,
        },
      });

      const result = await service.getMapRunItemCounts('arn:exec:1');

      expect(result).toEqual({
        pending: 1,
        running: 2,
        succeeded: 3,
        failed: 4,
        aborted: 5,
        timedOut: 6,
        total: 21,
      });
    });
  });
});
