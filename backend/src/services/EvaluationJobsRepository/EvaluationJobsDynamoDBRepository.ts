import {
  AttributeValue,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { createInjectionToken, inject } from '@trackit.io/di-container';
import { EvaluationJobsRepository } from 'backend/src/ports/EvaluationJobsEvaluation';
import { randomUUID } from 'crypto';
import {
  DEFAULT_METRICS_CONFIG,
  EvaluationJob,
  JobStatus,
  MetricsConfig,
  ModelConfig,
  ModelResult,
  Recommendation,
  WeightConfig,
} from '../../models/Evaluation';

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
    metrics: MetricsConfig,
  ): Promise<EvaluationJob> {
    const evaluationId = randomUUID();
    const now = new Date().toISOString();

    const job: EvaluationJob = {
      evaluation_id: evaluationId,
      dataset_id: datasetId,
      models,
      weights,
      metrics,
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
          metrics: { S: JSON.stringify(job.metrics) },
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

  public async getEvaluation(
    evaluationId: string,
  ): Promise<EvaluationJob | null> {
    const result = await this.dynamoClient.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: {
          evaluation_id: { S: evaluationId },
        },
      }),
    );

    if (!result.Item) {
      return null;
    }

    const item = result.Item;

    return {
      evaluation_id: item['evaluation_id'].S!,
      dataset_id: item['dataset_id'].S!,
      models: JSON.parse(item['models'].S!) as ModelConfig[],
      weights: JSON.parse(item['weights'].S!) as WeightConfig,
      metrics: item['metrics']?.S
        ? (JSON.parse(item['metrics'].S) as MetricsConfig)
        : { ...DEFAULT_METRICS_CONFIG },
      status: item['status'].S! as JobStatus,
      progress: Number(item['progress'].N ?? '0'),
      current_model: item['current_model']?.S,
      samples_processed:
        item['samples_processed']?.N !== undefined
          ? Number(item['samples_processed'].N)
          : undefined,
      total_samples:
        item['total_samples']?.N !== undefined
          ? Number(item['total_samples'].N)
          : undefined,
      error_message: item['error_message']?.S,
      created_at: item['created_at'].S!,
      updated_at: item['updated_at'].S!,
      completed_at: item['completed_at']?.S,
      model_results: item['model_results']?.S
        ? (JSON.parse(item['model_results'].S) as ModelResult[])
        : undefined,
      recommendation: item['recommendation']?.S
        ? (JSON.parse(item['recommendation'].S) as Recommendation)
        : undefined,
    };
  }
}

export const tokenEvaluationJobsRepository =
  createInjectionToken<EvaluationJobsRepository>('EvaluationJobsRepository', {
    useClass: EvaluationJobsRepositoryImpl,
  });
