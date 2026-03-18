import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvaluationRequest } from '../../models/Evaluation.js';
import { FakeEvaluationLaunchUseCase } from './FakeEvaluationLaunchUseCase';

// Mock dependencies
const mockEvaluationJobsRepository = {
  createEvaluation: vi.fn(),
};

const mockFargateService = {
  launchTask: vi.fn(),
};

describe('EvaluationLaunchUseCase - Weight Configuration', () => {
  let useCase: FakeEvaluationLaunchUseCase;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create instance with mocked dependencies
    useCase = new FakeEvaluationLaunchUseCase({
      evaluationJobsRepository: mockEvaluationJobsRepository,
      fargateService: mockFargateService,
    });

    // Setup default mock behavior
    mockEvaluationJobsRepository.createEvaluation.mockResolvedValue({
      evaluation_id: 'test-evaluation-id',
      dataset_id: 'test-dataset-id',
      models: [],
      weights: { accuracy: 0.33, latency: 0.33, cost: 0.34 },
      status: 'pending',
      progress: 0,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });

    mockFargateService.launchTask.mockResolvedValue(undefined);
  });

  describe('Default weights when not provided', () => {
    it('should use default weights (0.33, 0.33, 0.34) when weights are not provided', async () => {
      // Arrange
      const request: EvaluationRequest = {
        dataset_id: 'test-dataset-id',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        // No weights provided
      };

      // Act
      await useCase.launchEvaluation(request);

      // Assert
      expect(
        mockEvaluationJobsRepository.createEvaluation,
      ).toHaveBeenCalledWith('test-dataset-id', request.models, {
        accuracy: 0.33,
        latency: 0.33,
        cost: 0.34,
      });
    });

    it('should use default weights when weights object is empty', async () => {
      // Arrange
      const request: EvaluationRequest = {
        dataset_id: 'test-dataset-id',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        weights: {}, // Empty weights object
      };

      // Act
      await useCase.launchEvaluation(request);

      // Assert
      expect(
        mockEvaluationJobsRepository.createEvaluation,
      ).toHaveBeenCalledWith('test-dataset-id', request.models, {
        accuracy: 0.33,
        latency: 0.33,
        cost: 0.34,
      });
    });
  });

  describe('Negative weight rejection', () => {
    it('should reject negative accuracy weight', async () => {
      // Arrange
      const request: EvaluationRequest = {
        dataset_id: 'test-dataset-id',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        weights: {
          accuracy: -0.5,
          latency: 0.5,
          cost: 0.5,
        },
      };

      // Act & Assert
      await expect(useCase.launchEvaluation(request)).rejects.toThrow(
        'Weight values must be non-negative numbers',
      );
    });

    it('should reject negative latency weight', async () => {
      // Arrange
      const request: EvaluationRequest = {
        dataset_id: 'test-dataset-id',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        weights: {
          accuracy: 0.5,
          latency: -0.5,
          cost: 0.5,
        },
      };

      // Act & Assert
      await expect(useCase.launchEvaluation(request)).rejects.toThrow(
        'Weight values must be non-negative numbers',
      );
    });

    it('should reject negative cost weight', async () => {
      // Arrange
      const request: EvaluationRequest = {
        dataset_id: 'test-dataset-id',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        weights: {
          accuracy: 0.5,
          latency: 0.5,
          cost: -0.5,
        },
      };

      // Act & Assert
      await expect(useCase.launchEvaluation(request)).rejects.toThrow(
        'Weight values must be non-negative numbers',
      );
    });

    it('should reject when all weights are negative', async () => {
      // Arrange
      const request: EvaluationRequest = {
        dataset_id: 'test-dataset-id',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        weights: {
          accuracy: -0.1,
          latency: -0.2,
          cost: -0.3,
        },
      };

      // Act & Assert
      await expect(useCase.launchEvaluation(request)).rejects.toThrow(
        'Weight values must be non-negative numbers',
      );
    });
  });

  describe('Weight normalization', () => {
    it('should normalize weights to sum to 1.0', async () => {
      // Arrange
      const request: EvaluationRequest = {
        dataset_id: 'test-dataset-id',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        weights: {
          accuracy: 0.5,
          latency: 0.5,
          cost: 0.5,
        },
      };

      // Act
      await useCase.launchEvaluation(request);

      // Assert
      const normalizedWeights =
        mockEvaluationJobsRepository.createEvaluation.mock.calls[0][2];
      const sum =
        normalizedWeights.accuracy +
        normalizedWeights.latency +
        normalizedWeights.cost;

      expect(sum).toBeCloseTo(1.0, 10);
      expect(normalizedWeights.accuracy).toBeCloseTo(0.333333, 5);
      expect(normalizedWeights.latency).toBeCloseTo(0.333333, 5);
      expect(normalizedWeights.cost).toBeCloseTo(0.333333, 5);
    });

    it('should handle zero sum by returning default weights', async () => {
      // Arrange
      const request: EvaluationRequest = {
        dataset_id: 'test-dataset-id',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        weights: {
          accuracy: 0,
          latency: 0,
          cost: 0,
        },
      };

      // Act
      await useCase.launchEvaluation(request);

      // Assert
      expect(
        mockEvaluationJobsRepository.createEvaluation,
      ).toHaveBeenCalledWith('test-dataset-id', request.models, {
        accuracy: 0.33,
        latency: 0.33,
        cost: 0.34,
      });
    });

    it('should normalize partial weights and use defaults for missing values', async () => {
      // Arrange
      const request: EvaluationRequest = {
        dataset_id: 'test-dataset-id',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        weights: {
          accuracy: 0.8,
          // latency not provided, should use default 0.33
          cost: 0.2,
        },
      };

      // Act
      await useCase.launchEvaluation(request);

      // Assert
      const normalizedWeights =
        mockEvaluationJobsRepository.createEvaluation.mock.calls[0][2];
      const sum =
        normalizedWeights.accuracy +
        normalizedWeights.latency +
        normalizedWeights.cost;

      expect(sum).toBeCloseTo(1.0, 10);
      // With accuracy=0.8, latency=0.33 (default), cost=0.2
      // Sum = 1.33, normalized: accuracy=0.8/1.33≈0.6015, latency=0.33/1.33≈0.2481, cost=0.2/1.33≈0.1504
      expect(normalizedWeights.accuracy).toBeCloseTo(0.6015, 4);
      expect(normalizedWeights.latency).toBeCloseTo(0.2481, 4);
      expect(normalizedWeights.cost).toBeCloseTo(0.1504, 4);
    });

    it('should normalize weights with different proportions', async () => {
      // Arrange
      const request: EvaluationRequest = {
        dataset_id: 'test-dataset-id',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        weights: {
          accuracy: 0.7,
          latency: 0.2,
          cost: 0.1,
        },
      };

      // Act
      await useCase.launchEvaluation(request);

      // Assert
      const normalizedWeights =
        mockEvaluationJobsRepository.createEvaluation.mock.calls[0][2];
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
      // Arrange
      const request: EvaluationRequest = {
        dataset_id: 'test-dataset-id',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        weights: {
          accuracy: 1.5,
          latency: 0.5,
          cost: 0.5,
        },
      };

      // Act
      await useCase.launchEvaluation(request);

      // Assert
      const normalizedWeights =
        mockEvaluationJobsRepository.createEvaluation.mock.calls[0][2];
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
      // Arrange
      const request: EvaluationRequest = {
        dataset_id: 'test-dataset-id',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        weights: {
          accuracy: 0.5,
          // latency and cost not provided
        },
      };

      // Act
      await useCase.launchEvaluation(request);

      // Assert
      const normalizedWeights =
        mockEvaluationJobsRepository.createEvaluation.mock.calls[0][2];
      const sum =
        normalizedWeights.accuracy +
        normalizedWeights.latency +
        normalizedWeights.cost;

      expect(sum).toBeCloseTo(1.0, 10);
      // With accuracy=0.5, latency=0.33 (default), cost=0.34 (default)
      // Sum = 1.17, normalized: accuracy=0.5/1.17≈0.4274, latency=0.33/1.17≈0.2821, cost=0.34/1.17≈0.2906
      expect(normalizedWeights.accuracy).toBeCloseTo(0.4274, 4);
      expect(normalizedWeights.latency).toBeCloseTo(0.2821, 4);
      expect(normalizedWeights.cost).toBeCloseTo(0.2906, 4);
    });

    it('should accept zero as valid weight value', async () => {
      // Arrange
      const request: EvaluationRequest = {
        dataset_id: 'test-dataset-id',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        weights: {
          accuracy: 0,
          latency: 0.5,
          cost: 0.5,
        },
      };

      // Act
      await useCase.launchEvaluation(request);

      // Assert
      const normalizedWeights =
        mockEvaluationJobsRepository.createEvaluation.mock.calls[0][2];
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
