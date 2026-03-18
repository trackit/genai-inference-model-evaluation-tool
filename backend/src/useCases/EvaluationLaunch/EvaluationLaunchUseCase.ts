import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import {
  EvaluationJob,
  EvaluationRequest,
  ModelConfig,
  WeightConfig,
} from '../../models/Evaluation';
import { tokenEvaluationJobsRepository } from '../../services/EvaluationJobsRepository/EvaluationJobsRepository';
import { tokenFargateService } from '../../services/FargateService/FargateService';

export type EvaluationLaunchUseCase = {
  launchEvaluation(request: EvaluationRequest): Promise<EvaluationJob>;
};

class EvaluationLaunchUseCaseImpl implements EvaluationLaunchUseCase {
  private readonly evaluationJobsRepository = inject(
    tokenEvaluationJobsRepository,
  );
  private readonly fargateService = inject(tokenFargateService);

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
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'NO_MODELS',
        'At least one model must be selected',
      );
    }

    for (const model of models) {
      if (model.type === 'default') {
        const validDefaultIdentifiers = [
          'claude-sonnet',
          'claude-opus',
          'amazon-nova',
        ];
        if (!validDefaultIdentifiers.includes(model.identifier)) {
          throw new BasicError(
            BasicErrorType.BAD_REQUEST,
            'INVALID_MODEL_IDENTIFIER',
            `Invalid default model identifier: ${model.identifier}`,
          );
        }
      } else {
        throw new BasicError(
          BasicErrorType.BAD_REQUEST,
          'INVALID_MODEL_TYPE',
          `Invalid model type: ${model.type}`,
        );
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
      accuracy: accuracy / sum,
      latency: latency / sum,
      cost: cost / sum,
    };
  }
}

export const tokenEvaluationLaunchUseCase =
  createInjectionToken<EvaluationLaunchUseCase>('EvaluationLaunchUseCase', {
    useClass: EvaluationLaunchUseCaseImpl,
  });
