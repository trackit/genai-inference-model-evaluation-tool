import {
  AttributeValue,
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { createInjectionToken, inject } from '@trackit.io/di-container';
import { randomUUID } from 'crypto';
import {
  EvaluationJob,
  JobStatus,
  ModelConfig,
  WeightConfig,
} from '../../models/Evaluation';

export type EvaluationJobsRepository = {
  createEvaluation(
    datasetId: string,
    models: ModelConfig[],
    weights: WeightConfig,
  ): Promise<EvaluationJob>;

  updateEvaluation(
    evaluationId: string,
    updates: {
      status?: JobStatus;
      progress?: number;
      current_model?: string;
      samples_processed?: number;
      total_samples?: number;
      error_message?: string;
    },
  ): Promise<void>;
};

export const tokenDynamoDBClient = createInjectionToken<DynamoDBClient>(
  'DynamoDBClient',
  { useClass: DynamoDBClient },
);

class EvaluationJobsRepositoryImpl implements EvaluationJobsRepository {
  private readonly tableName = process.env.DYNAMODB_TABLE!;
  private readonly dynamoClient = inject(tokenDynamoDBClient);

  public async createEvaluation(
    datasetId: string,
    models: ModelConfig[],
    weights: WeightConfig,
  ): Promise<EvaluationJob> {
    const evaluationId = randomUUID();
    const now = new Date().toISOString();

    const job: EvaluationJob = {
      evaluation_id: evaluationId,
      dataset_id: datasetId,
      models,
      weights,
      status: 'pending',
      progress: 0,
      created_at: now,
      updated_at: now,
    };

    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: {
          evaluation_id: { S: job.evaluation_id },
          dataset_id: { S: job.dataset_id },
          models: { S: JSON.stringify(job.models) },
          weights: { S: JSON.stringify(job.weights) },
          status: { S: job.status },
          progress: { N: job.progress.toString() },
          created_at: { S: job.created_at },
          updated_at: { S: job.updated_at },
        },
      }),
    );

    return job;
  }

  public async updateEvaluation(
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
    const now = new Date().toISOString();
    const expressionParts: string[] = ['#updated_at = :updated_at'];
    const expressionNames: Record<string, string> = {
      '#updated_at': 'updated_at',
    };
    const expressionValues: Record<string, AttributeValue> = {
      ':updated_at': { S: now },
    };

    if (updates.status !== undefined) {
      expressionParts.push('#status = :status');
      expressionNames['#status'] = 'status';
      expressionValues[':status'] = { S: updates.status };
    }
    if (updates.progress !== undefined) {
      expressionParts.push('#progress = :progress');
      expressionNames['#progress'] = 'progress';
      expressionValues[':progress'] = { N: updates.progress.toString() };
    }
    if (updates.current_model !== undefined) {
      expressionParts.push('#current_model = :current_model');
      expressionNames['#current_model'] = 'current_model';
      expressionValues[':current_model'] = { S: updates.current_model };
    }
    if (updates.samples_processed !== undefined) {
      expressionParts.push('#samples_processed = :samples_processed');
      expressionNames['#samples_processed'] = 'samples_processed';
      expressionValues[':samples_processed'] = {
        N: updates.samples_processed.toString(),
      };
    }
    if (updates.total_samples !== undefined) {
      expressionParts.push('#total_samples = :total_samples');
      expressionNames['#total_samples'] = 'total_samples';
      expressionValues[':total_samples'] = {
        N: updates.total_samples.toString(),
      };
    }
    if (updates.error_message !== undefined) {
      expressionParts.push('#error_message = :error_message');
      expressionNames['#error_message'] = 'error_message';
      expressionValues[':error_message'] = { S: updates.error_message };
    }

    await this.dynamoClient.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: {
          evaluation_id: { S: evaluationId },
        },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
      }),
    );
  }
}

export const tokenEvaluationJobsRepository =
  createInjectionToken<EvaluationJobsRepository>('EvaluationJobsRepository', {
    useClass: EvaluationJobsRepositoryImpl,
  });
