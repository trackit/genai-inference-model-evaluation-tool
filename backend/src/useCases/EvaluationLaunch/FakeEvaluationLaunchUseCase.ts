import type {
  EvaluationJob,
  EvaluationRequest,
  ModelConfig,
  WeightConfig,
} from '../../models/Evaluation.js';
import {
  type BedrockModelValidationService,
  FakeBedrockModelValidationService,
} from '../../services/BedrockModelValidationService/BedrockModelValidationService.js';
import { EvaluationLaunchUseCase } from './EvaluationLaunchUseCase';

export interface MockDependencies {
  evaluationJobsRepository: {
    createEvaluation: (...args: unknown[]) => Promise<EvaluationJob>;
  };
  fargateService: {
    launchTask: (...args: unknown[]) => Promise<void>;
  };
  bedrockModelValidation?: BedrockModelValidationService;
}

export class FakeEvaluationLaunchUseCase implements EvaluationLaunchUseCase {
  private evaluationJobsRepository: MockDependencies['evaluationJobsRepository'];
  private fargateService: MockDependencies['fargateService'];
  private bedrockModelValidation: BedrockModelValidationService;

  constructor(dependencies: MockDependencies) {
    this.evaluationJobsRepository = dependencies.evaluationJobsRepository;
    this.fargateService = dependencies.fargateService;
    this.bedrockModelValidation =
      dependencies.bedrockModelValidation ??
      new FakeBedrockModelValidationService();
  }

  async launchEvaluation(request: EvaluationRequest): Promise<EvaluationJob> {
    this.validateModels(request.models);

    const modelsToPersist =
      await this.bedrockModelValidation.resolveModelsForPersistence(
        request.models,
      );

    const normalizedWeights = this.normalizeWeights(request.weights);

    const job = await this.evaluationJobsRepository.createEvaluation(
      request.dataset_id,
      modelsToPersist,
      normalizedWeights,
    );

    await this.fargateService.launchTask(job.evaluation_id);

    return job;
  }

  private validateModels(models: ModelConfig[]): void {
    if (!models || models.length === 0) {
      throw new Error('At least one model must be selected');
    }

    const validDefaultIdentifiers = [
      'claude-sonnet',
      'claude-opus',
      'amazon-nova',
      'amazon-nova-lite',
      'amazon-nova-micro',
    ];

    for (const model of models) {
      switch (model.type) {
        case 'default':
          if (!validDefaultIdentifiers.includes(model.identifier)) {
            throw new Error(
              `Invalid default model identifier: ${model.identifier}`,
            );
          }
          break;
        case 'custom':
          if (!model.identifier.trim()) {
            throw new Error(
              'Custom model identifier must be a non-empty Bedrock model ID',
            );
          }
          break;
        default: {
          throw new Error(`Invalid model type: ${(model as ModelConfig).type}`);
        }
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
