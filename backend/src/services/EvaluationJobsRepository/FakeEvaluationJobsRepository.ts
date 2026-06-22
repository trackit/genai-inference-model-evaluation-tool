import { createInjectionToken } from '@trackit.io/di-container';
import { randomUUID } from 'crypto';
import {
  EvaluationJob,
  JobStatus,
  MetricsConfig,
  ModelConfig,
  WeightConfig,
} from '../../models/Evaluation';
import { EvaluationJobsRepository } from '../../ports/EvaluationJobsRepository';

export class FakeEvaluationJobsRepository implements EvaluationJobsRepository {
  public readonly evaluationJobs: EvaluationJob[] = [];

  async createEvaluation(
    datasetId: string,
    models: ModelConfig[],
    weights: WeightConfig,
    metrics: MetricsConfig,
  ): Promise<EvaluationJob> {
    const now = new Date().toISOString();
    const job: EvaluationJob = {
      evaluation_id: randomUUID(),
      dataset_id: datasetId,
      models,
      weights,
      metrics,
      status: 'pending',
      progress: 0,
      created_at: now,
      updated_at: now,
    };
    this.evaluationJobs.push(job);
    return job;
  }

  async updateEvaluation(
    evaluationId: string,
    updates: {
      status?: JobStatus;
      progress?: number;
      current_model?: string;
      samples_processed?: number;
      total_samples?: number;
      error_message?: string;
    },
  ): Promise<void> {
    const job = this.evaluationJobs.find(
      (j) => j.evaluation_id === evaluationId,
    );
    if (!job) {
      return;
    }

    if (updates.status !== undefined) {
      job.status = updates.status;
    }
    if (updates.progress !== undefined) {
      job.progress = updates.progress;
    }
    if (updates.current_model !== undefined) {
      job.current_model = updates.current_model;
    }
    if (updates.samples_processed !== undefined) {
      job.samples_processed = updates.samples_processed;
    }
    if (updates.total_samples !== undefined) {
      job.total_samples = updates.total_samples;
    }
    if (updates.error_message !== undefined) {
      job.error_message = updates.error_message;
    }
    job.updated_at = new Date().toISOString();
  }

  async getEvaluation(evaluationId: string): Promise<EvaluationJob | null> {
    return (
      this.evaluationJobs.find((j) => j.evaluation_id === evaluationId) ?? null
    );
  }
}

export const tokenFakeEvaluationJobsRepository =
  createInjectionToken<FakeEvaluationJobsRepository>(
    'FakeEvaluationJobsRepository',
    { useClass: FakeEvaluationJobsRepository },
  );
