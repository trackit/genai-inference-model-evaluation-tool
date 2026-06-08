import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import { EvaluationStatusData } from '../../models/Evaluation';
import { tokenEvaluationJobsRepository } from '../../services/EvaluationJobsRepository/EvaluationJobsDynamoDBRepository';

export type GetEvaluationStatusUseCase = {
  getStatus(evaluationId: string): Promise<EvaluationStatusData>;
};

class GetEvaluationStatusUseCaseImpl implements GetEvaluationStatusUseCase {
  private readonly evaluationJobsRepository = inject(
    tokenEvaluationJobsRepository,
  );

  async getStatus(evaluationId: string): Promise<EvaluationStatusData> {
    const job = await this.evaluationJobsRepository.getEvaluation(evaluationId);

    if (!job) {
      throw new BasicError(
        BasicErrorType.NOT_FOUND,
        'NOT_FOUND',
        `Evaluation job not found: ${evaluationId}`,
      );
    }

    const statusData: EvaluationStatusData = {
      evaluation_id: job.evaluation_id,
      status: job.status,
      progress: job.progress,
      current_model: job.current_model,
      samples_processed: job.samples_processed,
      total_samples: job.total_samples,
    };

    if (job.status === 'failed' || job.status === 'timeout') {
      statusData.error_message =
        job.error_message ?? 'Evaluation job did not complete successfully';
    }

    return statusData;
  }
}

export const tokenGetEvaluationStatusUseCase =
  createInjectionToken<GetEvaluationStatusUseCase>(
    'GetEvaluationStatusUseCase',
    { useClass: GetEvaluationStatusUseCaseImpl },
  );
