import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import {
  EvaluationJob,
  EvaluationRequest,
  ModelConfig,
  ModelMode,
  resolveMetricsConfig,
  WeightConfig,
} from '../../models/Evaluation';
import { tokenBedrockModelValidationService } from '../../services/BedrockModelValidationService/BedrockModelValidationService';
import { tokenEvaluationJobsRepository } from '../../services/EvaluationJobsRepository/EvaluationJobsDynamoDBRepository';
import { tokenFargateService } from '../../services/FargateService/FargateService';

export type EvaluationLaunchUseCase = {
  launchEvaluation(request: EvaluationRequest): Promise<EvaluationJob>;
};

export class EvaluationLaunchUseCaseImpl implements EvaluationLaunchUseCase {
  private readonly evaluationJobsRepository = inject(
    tokenEvaluationJobsRepository,
  );
  private readonly fargateService = inject(tokenFargateService);
  private readonly bedrockModelValidation = inject(
    tokenBedrockModelValidationService,
  );

  async launchEvaluation(request: EvaluationRequest): Promise<EvaluationJob> {
    this.validateModels(request.models);

    // TODO: validate mantle models against the Chat Completions / Responses catalogs.
    const runtimeModels = request.models.filter(
      (m) => m.mode === ModelMode.RUNTIME,
    );
    const mantleModels = request.models.filter(
      (m) => m.mode !== ModelMode.RUNTIME,
    );
    const resolvedRuntimeModels =
      await this.bedrockModelValidation.resolveModelsForPersistence(
        runtimeModels,
      );

    const normalizedWeights = this.normalizeWeights(request.weights);
    const metrics = resolveMetricsConfig(request.metrics);

    if (
      request.metrics &&
      !Object.values(request.metrics).some((v) => v === true)
    ) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'NO_METRICS_SELECTED',
        'At least one accuracy metric must be selected',
      );
    }

    const job = await this.evaluationJobsRepository.createEvaluation(
      request.dataset_id,
      [...mantleModels, ...resolvedRuntimeModels],
      normalizedWeights,
      metrics,
    );
    await this.fargateService.launchTask(job.evaluation_id);

    return job;
  }

  private validateModels(models: ModelConfig[]): void {
    if (!models || models.length === 0) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'NO_MODELS',
        'At least one model must be selected',
      );
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
            throw new BasicError(
              BasicErrorType.BAD_REQUEST,
              'INVALID_MODEL_IDENTIFIER',
              `Invalid default model identifier: ${model.identifier}`,
            );
          }
          break;
        case 'custom':
          if (!model.identifier.trim()) {
            throw new BasicError(
              BasicErrorType.BAD_REQUEST,
              'INVALID_MODEL_IDENTIFIER',
              'Custom model identifier must be a non-empty Bedrock model ID',
            );
          }
          break;
        default: {
          const _exhaustive: never = model;
          return _exhaustive;
        }
      }
    }
  }

  private normalizeWeights(weights?: Partial<WeightConfig>): WeightConfig {
    const defaultWeights: WeightConfig = {
      accuracy: 0.4,
      latency: 0.3,
      cost: 0.3,
    };

    if (!weights) {
      return defaultWeights;
    }

    const accuracy = weights.accuracy ?? defaultWeights.accuracy;
    const latency = weights.latency ?? defaultWeights.latency;
    const cost = weights.cost ?? defaultWeights.cost;

    if (accuracy < 0 || latency < 0 || cost < 0) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'NEGATIVE_WEIGHTS',
        'Weight values must be non-negative numbers',
      );
    }

    const sum = accuracy + latency + cost;

    if (sum === 0) {
      return defaultWeights;
    }

    return {
      accuracy: Math.round((accuracy / sum) * 100) / 100,
      latency: Math.round((latency / sum) * 100) / 100,
      cost: Math.round((cost / sum) * 100) / 100,
    };
  }
}

export const tokenEvaluationLaunchUseCase =
  createInjectionToken<EvaluationLaunchUseCase>('EvaluationLaunchUseCase', {
    useClass: EvaluationLaunchUseCaseImpl,
  });
