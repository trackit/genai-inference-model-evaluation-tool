import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';
import { BasicErrorType } from '../../errors';
import {
  DEFAULT_METRICS_CONFIG,
  type EvaluationJob,
} from '../../models/Evaluation';
import type { FakeEvaluationJobsRepository } from '../../services/EvaluationJobsRepository/FakeEvaluationJobsRepository';
import { tokenFakeEvaluationJobsRepository } from '../../services/EvaluationJobsRepository/FakeEvaluationJobsRepository';
import { registerFakeInfrastructue } from '../../test/registerTestInfrastructure';
import { tokenGetEvaluationStatusUseCase } from './GetEvaluationStatusUseCase';

describe('GetEvaluationStatusUseCase', () => {
  describe('when job exists', () => {
    it('should map running job status fields', async () => {
      const { useCase, evaluationJobsRepository } = setup();
      seedJob(evaluationJobsRepository, {
        evaluation_id: 'eval-running',
        status: 'running',
        progress: 42,
        current_model: 'anthropic.claude-3-5-sonnet',
        samples_processed: 4,
        total_samples: 10,
      });

      const status = await useCase.getStatus('eval-running');

      expect(status).toEqual({
        evaluation_id: 'eval-running',
        status: 'running',
        progress: 42,
        current_model: 'anthropic.claude-3-5-sonnet',
        samples_processed: 4,
        total_samples: 10,
      });
      expect(status.error_message).toBeUndefined();
    });

    it('should not include error_message for completed jobs', async () => {
      const { useCase, evaluationJobsRepository } = setup();
      seedJob(evaluationJobsRepository, {
        evaluation_id: 'eval-completed',
        status: 'completed',
        progress: 100,
        error_message: 'should not leak to status response',
      });

      const status = await useCase.getStatus('eval-completed');

      expect(status.status).toBe('completed');
      expect(status.error_message).toBeUndefined();
    });
  });

  describe('error_message for terminal failures', () => {
    it('should include stored error_message for failed jobs', async () => {
      const { useCase, evaluationJobsRepository } = setup();
      seedJob(evaluationJobsRepository, {
        evaluation_id: 'eval-failed',
        status: 'failed',
        progress: 80,
        error_message: 'Model invocation failed',
      });

      const status = await useCase.getStatus('eval-failed');

      expect(status.error_message).toBe('Model invocation failed');
    });

    it('should use fallback error_message when failed job has none', async () => {
      const { useCase, evaluationJobsRepository } = setup();
      seedJob(evaluationJobsRepository, {
        evaluation_id: 'eval-failed-no-message',
        status: 'failed',
        progress: 10,
      });

      const status = await useCase.getStatus('eval-failed-no-message');

      expect(status.error_message).toBe(
        'Evaluation job did not complete successfully',
      );
    });

    it('should include error_message for timeout jobs', async () => {
      const { useCase, evaluationJobsRepository } = setup();
      seedJob(evaluationJobsRepository, {
        evaluation_id: 'eval-timeout',
        status: 'timeout',
        progress: 95,
        error_message: 'Evaluation exceeded time limit',
      });

      const status = await useCase.getStatus('eval-timeout');

      expect(status.error_message).toBe('Evaluation exceeded time limit');
    });
  });

  describe('when job is missing', () => {
    it('should throw NOT_FOUND BasicError', async () => {
      const { useCase } = setup();

      await expect(useCase.getStatus('missing-eval-id')).rejects.toMatchObject({
        name: 'BasicError',
        type: BasicErrorType.NOT_FOUND,
        code: 'NOT_FOUND',
        message: 'Evaluation job not found: missing-eval-id',
      });
    });
  });
});

const setup = () => {
  reset();
  registerFakeInfrastructue();

  return {
    useCase: inject(tokenGetEvaluationStatusUseCase),
    evaluationJobsRepository: inject(tokenFakeEvaluationJobsRepository),
  };
};

function seedJob(
  repository: FakeEvaluationJobsRepository,
  overrides: Partial<EvaluationJob> & Pick<EvaluationJob, 'evaluation_id'>,
): EvaluationJob {
  const job: EvaluationJob = {
    dataset_id: 'dataset-1',
    models: [{ type: 'default', identifier: 'claude-sonnet' }],
    weights: { accuracy: 0.4, latency: 0.3, cost: 0.3 },
    metrics: DEFAULT_METRICS_CONFIG,
    status: 'pending',
    progress: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    ...overrides,
  };
  repository.evaluationJobs.push(job);
  return job;
}
