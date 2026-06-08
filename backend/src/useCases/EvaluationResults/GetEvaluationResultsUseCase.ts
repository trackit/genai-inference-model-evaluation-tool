import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { EvaluationResultsData } from '../../models/Evaluation';
import { tokenEvaluationJobsRepository } from '../../services/EvaluationJobsRepository/EvaluationJobsDynamoDBRepository';

export type GetEvaluationResultsUseCase = {
  getResults(evaluationId: string): Promise<EvaluationResultsData>;
};

class GetEvaluationResultsUseCaseImpl implements GetEvaluationResultsUseCase {
  private readonly evaluationJobsRepository = inject(
    tokenEvaluationJobsRepository,
  );

  async getResults(evaluationId: string): Promise<EvaluationResultsData> {
    const job = await this.evaluationJobsRepository.getEvaluation(evaluationId);

    if (!job) {
      throw new BasicError(
        BasicErrorType.NOT_FOUND,
        'NOT_FOUND',
        `Evaluation job not found: ${evaluationId}`,
      );
    }

    return {
      evaluation_id: job.evaluation_id,
      dataset_id: job.dataset_id,
      models: job.model_results ?? [],
      recommendation: job.recommendation ?? {
        model_identifier: '',
        weighted_score: 0,
        reasoning: '',
      },
      weights: job.weights,
      completed_at: job.completed_at ?? job.updated_at,
    };
  }
}

export const tokenGetEvaluationResultsUseCase =
  createInjectionToken<GetEvaluationResultsUseCase>(
    'GetEvaluationResultsUseCase',
    { useClass: GetEvaluationResultsUseCaseImpl },
  );
