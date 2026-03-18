import type {
  EvaluationJob,
  EvaluationRequest,
  ModelConfig,
  WeightConfig,
} from '../../models/Evaluation.js';
import { EvaluationLaunchUseCase } from './EvaluationLaunchUseCase';

// Mock dependencies that can be injected
export interface MockDependencies {
  evaluationJobsRepository: {
    createEvaluation: (...args: unknown[]) => Promise<EvaluationJob>;
  };
  fargateService: {
    launchTask: (...args: unknown[]) => Promise<void>;
  };
}

// Create a fake implementation for testing
export class FakeEvaluationLaunchUseCase implements EvaluationLaunchUseCase {
  private evaluationJobsRepository: MockDependencies['evaluationJobsRepository'];
  private fargateService: MockDependencies['fargateService'];

  constructor(dependencies: MockDependencies) {
    this.evaluationJobsRepository = dependencies.evaluationJobsRepository;
    this.fargateService = dependencies.fargateService;
  }

  async launchEvaluation(request: EvaluationRequest): Promise<EvaluationJob> {
    this.validateModels(request.models);

    const normalizedWeights = this.normalizeWeights(request.weights);

    const job = await this.evaluationJobsRepository.createEvaluation(
      request.dataset_id,
      request.models,
      normalizedWeights,
    );

    await this.fargateService.launchTask(job.evaluation_id);

    return job;
  }

  private validateModels(models: ModelConfig[]): void {
    if (!models || models.length === 0) {
      throw new Error('At least one model must be selected');
    }

    for (const model of models) {
      if (model.type === 'default') {
        const validDefaultIdentifiers = [
          'claude-sonnet',
          'claude-opus',
          'amazon-nova',
        ];
        if (!validDefaultIdentifiers.includes(model.identifier)) {
          throw new Error(
            `Invalid default model identifier: ${model.identifier}`,
          );
        }
      } else {
        throw new Error(`Invalid model type: ${model.type}`);
      }
    }
  }

  private normalizeWeights(weights?: Partial<WeightConfig>): WeightConfig {
    const defaultWeights: WeightConfig = {
      accuracy: 0.33,
      latency: 0.33,
      cost: 0.34,
    };

    if (!weights) {
      return defaultWeights;
    }

    const accuracy = weights.accuracy ?? defaultWeights.accuracy;
    const latency = weights.latency ?? defaultWeights.latency;
    const cost = weights.cost ?? defaultWeights.cost;

    if (accuracy < 0 || latency < 0 || cost < 0) {
      throw new Error('Weight values must be non-negative numbers');
    }

    const sum = accuracy + latency + cost;

    if (sum === 0) {
      return defaultWeights;
    }

    return {
      accuracy: accuracy / sum,
      latency: latency / sum,
      cost: cost / sum,
    };
  }
}
