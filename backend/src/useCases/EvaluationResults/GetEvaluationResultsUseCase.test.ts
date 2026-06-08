import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';
import { BasicErrorType } from '../../errors';
import {
  DEFAULT_METRICS_CONFIG,
  type EvaluationJob,
  type ModelResult,
  type Recommendation,
} from '../../models/Evaluation';
import type { FakeEvaluationJobsRepository } from '../../services/EvaluationJobsRepository/FakeEvaluationJobsRepository';
import { tokenFakeEvaluationJobsRepository } from '../../services/EvaluationJobsRepository/FakeEvaluationJobsRepository';
import { registerTestInfrastructue } from '../../test/registerTestInfrastructure';
import { tokenGetEvaluationResultsUseCase } from './GetEvaluationResultsUseCase';

const SAMPLE_MODEL_RESULT: ModelResult = {
  identifier: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  metrics: {
    latency: {
      tokens_per_second: 120,
      time_to_first_token_ms: 40,
      total_latency_ms: 480,
    },
    cost: {
      total_usd: 0.05,
      input_tokens: 200,
      output_tokens: 80,
    },
  },
  weighted_score: 0.87,
  status: 'completed',
};

const SAMPLE_RECOMMENDATION: Recommendation = {
  model_identifier: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  weighted_score: 0.87,
  reasoning: 'Best balance of accuracy, latency, and cost.',
};

describe('GetEvaluationResultsUseCase', () => {
  describe('when job exists', () => {
    it('should map completed evaluation results', async () => {
      const { useCase, evaluationJobsRepository } = setup();
      seedJob(evaluationJobsRepository, {
        evaluation_id: 'eval-complete',
        dataset_id: 'dataset-99',
        status: 'completed',
        progress: 100,
        weights: { accuracy: 0.5, latency: 0.3, cost: 0.2 },
        model_results: [SAMPLE_MODEL_RESULT],
        recommendation: SAMPLE_RECOMMENDATION,
        completed_at: '2024-03-01T12:00:00Z',
        updated_at: '2024-03-01T11:59:00Z',
      });

      const results = await useCase.getResults('eval-complete');

      expect(results).toEqual({
        evaluation_id: 'eval-complete',
        dataset_id: 'dataset-99',
        models: [SAMPLE_MODEL_RESULT],
        recommendation: SAMPLE_RECOMMENDATION,
        weights: { accuracy: 0.5, latency: 0.3, cost: 0.2 },
        completed_at: '2024-03-01T12:00:00Z',
      });
    });

    it('should default models to an empty array when model_results is missing', async () => {
      const { useCase, evaluationJobsRepository } = setup();
      seedJob(evaluationJobsRepository, {
        evaluation_id: 'eval-no-models',
        status: 'completed',
      });

      const results = await useCase.getResults('eval-no-models');

      expect(results.models).toEqual([]);
    });

    it('should default recommendation when missing', async () => {
      const { useCase, evaluationJobsRepository } = setup();
      seedJob(evaluationJobsRepository, {
        evaluation_id: 'eval-no-recommendation',
        status: 'completed',
      });

      const results = await useCase.getResults('eval-no-recommendation');

      expect(results.recommendation).toEqual({
        model_identifier: '',
        weighted_score: 0,
        reasoning: '',
      });
    });

    it('should use updated_at when completed_at is missing', async () => {
      const { useCase, evaluationJobsRepository } = setup();
      seedJob(evaluationJobsRepository, {
        evaluation_id: 'eval-no-completed-at',
        status: 'completed',
        updated_at: '2024-04-15T08:30:00Z',
      });

      const results = await useCase.getResults('eval-no-completed-at');

      expect(results.completed_at).toBe('2024-04-15T08:30:00Z');
    });
  });

  describe('when job is missing', () => {
    it('should throw NOT_FOUND BasicError', async () => {
      const { useCase } = setup();

      await expect(useCase.getResults('missing-eval-id')).rejects.toMatchObject(
        {
          name: 'BasicError',
          type: BasicErrorType.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'Evaluation job not found: missing-eval-id',
        },
      );
    });
  });
});

const setup = () => {
  reset();
  registerTestInfrastructue();

  return {
    useCase: inject(tokenGetEvaluationResultsUseCase),
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
