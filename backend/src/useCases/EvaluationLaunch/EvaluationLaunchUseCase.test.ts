import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_METRICS_CONFIG,
  type EvaluationRequest,
  ModelMode,
} from '../../models/Evaluation.js';
import { tokenFakeEvaluationJobsRepository } from '../../services/EvaluationJobsRepository/FakeEvaluationJobsRepository';
import { tokenFakeFargateService } from '../../services/FargateService/FakeFargateService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { EvaluationLaunchUseCaseImpl } from './EvaluationLaunchUseCase';

const DEFAULT_WEIGHTS = { accuracy: 0.4, latency: 0.3, cost: 0.3 };

const validLaunchRequest = (): EvaluationRequest => ({
  dataset_id: 'test-dataset-id',
  models: [
    { type: 'default', identifier: 'claude-sonnet', mode: ModelMode.RUNTIME },
  ],
  weights: DEFAULT_WEIGHTS,
});

describe('EvaluationLaunchUseCase', () => {
  describe('launchEvaluation', () => {
    it('should persist the job and launch a Fargate task with the evaluation id', async () => {
      const { useCase, evaluationJobsRepository, fargateService } = setup();
      const request = validLaunchRequest();

      const job = await useCase.launchEvaluation(request);

      expect(job.evaluation_id).toBe('test-evaluation-id');
      expect(evaluationJobsRepository.createEvaluation).toHaveBeenCalledOnce();
      expect(evaluationJobsRepository.createEvaluation).toHaveBeenCalledWith(
        request.dataset_id,
        [
          {
            type: 'default',
            identifier: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
            mode: ModelMode.RUNTIME,
          },
        ],
        DEFAULT_WEIGHTS,
        DEFAULT_METRICS_CONFIG,
      );
      expect(fargateService.launchedEvaluationIds).toEqual([
        'test-evaluation-id',
      ]);
    });
  });

  describe('Weight Configuration', () => {
    describe('Default weights when not provided', () => {
      it('should use default weights (0.4, 0.3, 0.3) when weights are not provided', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          // No weights provided
        };

        await useCase.launchEvaluation(request);

        expect(evaluationJobsRepository.createEvaluation).toHaveBeenCalledWith(
          'test-dataset-id',
          [
            {
              type: 'default',
              identifier: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
              mode: ModelMode.RUNTIME,
            },
          ],
          {
            accuracy: 0.4,
            latency: 0.3,
            cost: 0.3,
          },
          DEFAULT_METRICS_CONFIG,
        );
      });

      it('should use default weights when weights object is empty', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          weights: {}, // Empty weights object
        };

        await useCase.launchEvaluation(request);

        expect(evaluationJobsRepository.createEvaluation).toHaveBeenCalledWith(
          'test-dataset-id',
          [
            {
              type: 'default',
              identifier: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
              mode: ModelMode.RUNTIME,
            },
          ],
          {
            accuracy: 0.4,
            latency: 0.3,
            cost: 0.3,
          },
          DEFAULT_METRICS_CONFIG,
        );
      });
    });

    describe('Metrics toggles', () => {
      it('should default to all metrics enabled when metrics not provided', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
        };

        await useCase.launchEvaluation(request);

        const metricsArg =
          evaluationJobsRepository.createEvaluation.mock.calls[0][3];
        expect(metricsArg).toEqual(DEFAULT_METRICS_CONFIG);
      });

      it('should respect explicitly disabled metrics', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],

          metrics: {
            bleu: true,
            bertscore: false,
            geval_reasoning: false,
            geval_faithfulness: false,
          },
        };

        await useCase.launchEvaluation(request);

        const metricsArg =
          evaluationJobsRepository.createEvaluation.mock.calls[0][3];
        expect(metricsArg).toEqual({
          ...DEFAULT_METRICS_CONFIG,
          bleu: true,
          bertscore: false,
          geval_reasoning: false,
          geval_faithfulness: false,
        });
      });

      it('should fill in defaults for partially provided metrics', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          metrics: {
            rouge: true,
            geval_reasoning: false,
            geval_faithfulness: false,
          },
        };

        await useCase.launchEvaluation(request);

        const metricsArg =
          evaluationJobsRepository.createEvaluation.mock.calls[0][3];
        expect(metricsArg).toEqual({
          ...DEFAULT_METRICS_CONFIG,
          rouge: true,
          geval_reasoning: false,
          geval_faithfulness: false,
        });
      });

      it('should support disabling a single algorithmic metric', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          metrics: { bleu: false, rouge: true },
        };

        await useCase.launchEvaluation(request);

        const metricsArg =
          evaluationJobsRepository.createEvaluation.mock.calls[0][3];
        expect(metricsArg).toEqual({
          ...DEFAULT_METRICS_CONFIG,
          bleu: false,
          rouge: true,
        });
      });

      it('should reject when all metrics are explicitly disabled', async () => {
        const { useCase } = setup();
        const allDisabled: Partial<Record<string, boolean>> = {};
        for (const key of Object.keys(DEFAULT_METRICS_CONFIG)) {
          allDisabled[key] = false;
        }

        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          metrics: allDisabled,
        };

        await expect(useCase.launchEvaluation(request)).rejects.toThrow(
          'At least one accuracy metric must be selected',
        );
      });
    });

    describe('Negative weight rejection', () => {
      it('should reject negative accuracy weight', async () => {
        const { useCase } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          weights: {
            accuracy: -0.5,
            latency: 0.5,
            cost: 0.5,
          },
        };

        await expect(useCase.launchEvaluation(request)).rejects.toThrow(
          'Weight values must be non-negative numbers',
        );
      });

      it('should reject negative latency weight', async () => {
        const { useCase } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          weights: {
            accuracy: 0.5,
            latency: -0.5,
            cost: 0.5,
          },
        };

        await expect(useCase.launchEvaluation(request)).rejects.toThrow(
          'Weight values must be non-negative numbers',
        );
      });

      it('should reject negative cost weight', async () => {
        const { useCase } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          weights: {
            accuracy: 0.5,
            latency: 0.5,
            cost: -0.5,
          },
        };

        await expect(useCase.launchEvaluation(request)).rejects.toThrow(
          'Weight values must be non-negative numbers',
        );
      });

      it('should reject when all weights are negative', async () => {
        const { useCase } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          weights: {
            accuracy: -0.1,
            latency: -0.2,
            cost: -0.3,
          },
        };

        await expect(useCase.launchEvaluation(request)).rejects.toThrow(
          'Weight values must be non-negative numbers',
        );
      });
    });

    describe('Weight normalization', () => {
      it('should normalize weights to sum to 1.0', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          weights: {
            accuracy: 0.5,
            latency: 0.5,
            cost: 0.5,
          },
        };

        await useCase.launchEvaluation(request);

        const normalizedWeights =
          evaluationJobsRepository.createEvaluation.mock.calls[0][2];
        const sum =
          normalizedWeights.accuracy +
          normalizedWeights.latency +
          normalizedWeights.cost;

        expect(sum).toBeCloseTo(0.99, 2);
        expect(normalizedWeights.accuracy).toBe(0.33);
        expect(normalizedWeights.latency).toBe(0.33);
        expect(normalizedWeights.cost).toBe(0.33);
      });

      it('should handle zero sum by returning default weights', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          weights: {
            accuracy: 0,
            latency: 0,
            cost: 0,
          },
        };

        await useCase.launchEvaluation(request);

        expect(evaluationJobsRepository.createEvaluation).toHaveBeenCalledWith(
          'test-dataset-id',
          [
            {
              type: 'default',
              identifier: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
              mode: ModelMode.RUNTIME,
            },
          ],
          {
            accuracy: 0.4,
            latency: 0.3,
            cost: 0.3,
          },
          DEFAULT_METRICS_CONFIG,
        );
      });

      it('should normalize partial weights and use defaults for missing values', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          weights: {
            accuracy: 0.8,
            // latency not provided, should use default 0.3
            cost: 0.2,
          },
        };

        await useCase.launchEvaluation(request);

        const normalizedWeights =
          evaluationJobsRepository.createEvaluation.mock.calls[0][2];
        const sum =
          normalizedWeights.accuracy +
          normalizedWeights.latency +
          normalizedWeights.cost;

        expect(sum).toBeCloseTo(1.0, 10);
        expect(normalizedWeights.accuracy).toBe(0.62);
        expect(normalizedWeights.latency).toBe(0.23);
        expect(normalizedWeights.cost).toBe(0.15);
      });

      it('should normalize weights with different proportions', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          weights: {
            accuracy: 0.7,
            latency: 0.2,
            cost: 0.1,
          },
        };

        await useCase.launchEvaluation(request);

        const normalizedWeights =
          evaluationJobsRepository.createEvaluation.mock.calls[0][2];
        const sum =
          normalizedWeights.accuracy +
          normalizedWeights.latency +
          normalizedWeights.cost;

        expect(sum).toBeCloseTo(1.0, 10);
        // Already sums to 1.0, so should remain the same
        expect(normalizedWeights.accuracy).toBeCloseTo(0.7, 5);
        expect(normalizedWeights.latency).toBeCloseTo(0.2, 5);
        expect(normalizedWeights.cost).toBeCloseTo(0.1, 5);
      });

      it('should normalize weights that sum to more than 1.0', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          weights: {
            accuracy: 1.5,
            latency: 0.5,
            cost: 0.5,
          },
        };

        await useCase.launchEvaluation(request);

        const normalizedWeights =
          evaluationJobsRepository.createEvaluation.mock.calls[0][2];
        const sum =
          normalizedWeights.accuracy +
          normalizedWeights.latency +
          normalizedWeights.cost;

        expect(sum).toBeCloseTo(1.0, 10);
        // Sum = 2.5, normalized: accuracy=1.5/2.5=0.6, latency=0.5/2.5=0.2, cost=0.5/2.5=0.2
        expect(normalizedWeights.accuracy).toBeCloseTo(0.6, 5);
        expect(normalizedWeights.latency).toBeCloseTo(0.2, 5);
        expect(normalizedWeights.cost).toBeCloseTo(0.2, 5);
      });
    });

    describe('Edge cases', () => {
      it('should handle weight with only one dimension provided', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          weights: {
            accuracy: 0.5,
            // latency and cost not provided
          },
        };

        await useCase.launchEvaluation(request);

        const normalizedWeights =
          evaluationJobsRepository.createEvaluation.mock.calls[0][2];
        expect(normalizedWeights.accuracy).toBe(0.45);
        expect(normalizedWeights.latency).toBe(0.27);
        expect(normalizedWeights.cost).toBe(0.27);
        expect(
          normalizedWeights.accuracy +
            normalizedWeights.latency +
            normalizedWeights.cost,
        ).toBeCloseTo(0.99, 2);
      });

      it('should accept custom Bedrock model IDs', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'custom',
              identifier: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
              mode: ModelMode.RUNTIME,
            },
            {
              type: 'custom',
              identifier: 'us.amazon.nova-pro-v1:0',
              mode: ModelMode.RUNTIME,
            },
          ],
        };

        await useCase.launchEvaluation(request);

        expect(evaluationJobsRepository.createEvaluation).toHaveBeenCalledWith(
          'test-dataset-id',
          request.models,
          {
            accuracy: 0.4,
            latency: 0.3,
            cost: 0.3,
          },
          DEFAULT_METRICS_CONFIG,
        );
      });

      it('should accept a mix of default and custom models', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'amazon-nova-lite',
              mode: ModelMode.RUNTIME,
            },
            {
              type: 'custom',
              identifier: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
              mode: ModelMode.RUNTIME,
            },
          ],
        };

        await useCase.launchEvaluation(request);

        expect(evaluationJobsRepository.createEvaluation).toHaveBeenCalledWith(
          'test-dataset-id',
          [
            {
              type: 'default',
              identifier: 'us.amazon.nova-lite-v1:0',
              mode: ModelMode.RUNTIME,
            },
            {
              type: 'custom',
              identifier: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
              mode: ModelMode.RUNTIME,
            },
          ],
          {
            accuracy: 0.4,
            latency: 0.3,
            cost: 0.3,
          },
          DEFAULT_METRICS_CONFIG,
        );
      });

      it('should accept a mix of runtime and mantle models', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'amazon-nova-lite',
              mode: ModelMode.RUNTIME,
            },
            {
              type: 'custom',
              identifier: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
              mode: ModelMode.MANTLE,
            },
          ],
        };

        await useCase.launchEvaluation(request);

        expect(evaluationJobsRepository.createEvaluation).toHaveBeenCalledWith(
          'test-dataset-id',
          [
            {
              type: 'custom',
              identifier: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
              mode: ModelMode.MANTLE,
            },
            {
              type: 'default',
              identifier: 'us.amazon.nova-lite-v1:0',
              mode: ModelMode.RUNTIME,
            },
          ],
          {
            accuracy: 0.4,
            latency: 0.3,
            cost: 0.3,
          },
          DEFAULT_METRICS_CONFIG,
        );
      });

      it('should reject blank custom model identifier', async () => {
        const { useCase } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'custom',
              identifier: '   ',
            },
          ],
        };

        await expect(useCase.launchEvaluation(request)).rejects.toThrow(
          'Custom model identifier must be a non-empty Bedrock model ID',
        );
      });

      it('should accept zero as valid weight value', async () => {
        const { useCase, evaluationJobsRepository } = setup();
        const request: EvaluationRequest = {
          dataset_id: 'test-dataset-id',
          models: [
            {
              type: 'default',
              identifier: 'claude-sonnet',
              mode: ModelMode.RUNTIME,
            },
          ],
          weights: {
            accuracy: 0,
            latency: 0.5,
            cost: 0.5,
          },
        };

        await useCase.launchEvaluation(request);

        const normalizedWeights =
          evaluationJobsRepository.createEvaluation.mock.calls[0][2];
        const sum =
          normalizedWeights.accuracy +
          normalizedWeights.latency +
          normalizedWeights.cost;

        expect(sum).toBeCloseTo(1.0, 10);
        // Sum = 1.0, normalized: accuracy=0, latency=0.5, cost=0.5
        expect(normalizedWeights.accuracy).toBeCloseTo(0, 5);
        expect(normalizedWeights.latency).toBeCloseTo(0.5, 5);
        expect(normalizedWeights.cost).toBeCloseTo(0.5, 5);
      });
    });
  });
});

const setup = () => {
  reset();
  registerTestInfrastructure();

  const evaluationJobsRepository = inject(tokenFakeEvaluationJobsRepository);
  vi.spyOn(evaluationJobsRepository, 'createEvaluation').mockResolvedValue({
    evaluation_id: 'test-evaluation-id',
    dataset_id: 'test-dataset-id',
    models: [],
    weights: DEFAULT_WEIGHTS,
    metrics: DEFAULT_METRICS_CONFIG,
    status: 'pending',
    progress: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  });

  return {
    useCase: new EvaluationLaunchUseCaseImpl(),
    evaluationJobsRepository,
    fargateService: inject(tokenFakeFargateService),
  };
};
