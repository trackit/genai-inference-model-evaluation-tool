import {
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { registerTestInfrastructue } from 'backend/src/test/registerTestInfrastructure';
import { describe, expect, it } from 'vitest';
import { DEFAULT_METRICS_CONFIG } from '../../models/Evaluation';
import {
  EvaluationJobsRepositoryImpl,
  tokenClientDynamoDB,
} from './EvaluationJobsDynamoDBRepository';

describe('EvaluationJobsDynamoDBRepository', () => {
  describe('createEvaluation', () => {
    it('should persist a pending job and return it', async () => {
      const { repository, dynamoClientMock } = setup();
      const models = [
        { type: 'default' as const, identifier: 'claude-sonnet' },
      ];
      const weights = { accuracy: 0.4, latency: 0.3, cost: 0.3 };
      const metrics = { ...DEFAULT_METRICS_CONFIG, bleu: true };

      const job = await repository.createEvaluation(
        'dataset-1',
        models,
        weights,
        metrics,
      );

      expect(dynamoClientMock.commandCalls(PutItemCommand)).toHaveLength(1);
      const putCall =
        dynamoClientMock.commandCalls(PutItemCommand)[0].args[0].input;
      expect(putCall).toMatchObject({
        TableName: 'evaluation-jobs-test',
        Item: {
          evaluation_id: { S: job.evaluation_id },
          dataset_id: { S: 'dataset-1' },
          models: { S: JSON.stringify(models) },
          weights: { S: JSON.stringify(weights) },
          metrics: { S: JSON.stringify(metrics) },
          status: { S: 'pending' },
          progress: { N: '0' },
        },
      });
      expect(job).toMatchObject({
        dataset_id: 'dataset-1',
        models,
        weights,
        metrics,
        status: 'pending',
        progress: 0,
      });
      expect(job.evaluation_id).toMatch(/^[a-f0-9-]+$/);
      expect(job.created_at).toBe(job.updated_at);
    });
  });

  describe('getEvaluation', () => {
    it('should return null when the item does not exist', async () => {
      const { repository, dynamoClientMock } = setup();
      dynamoClientMock.on(GetItemCommand).resolves({});

      const job = await repository.getEvaluation('missing-id');

      expect(job).toBeNull();
      expect(dynamoClientMock.commandCalls(GetItemCommand)).toHaveLength(1);
    });

    it('should deserialize a stored evaluation job', async () => {
      const { repository, dynamoClientMock } = setup();
      dynamoClientMock.on(GetItemCommand).resolves({
        Item: {
          evaluation_id: { S: 'eval-1' },
          dataset_id: { S: 'dataset-1' },
          models: {
            S: JSON.stringify([
              { type: 'custom', identifier: 'anthropic.claude-3-5-sonnet' },
            ]),
          },
          weights: {
            S: JSON.stringify({ accuracy: 0.5, latency: 0.3, cost: 0.2 }),
          },
          metrics: {
            S: JSON.stringify({ ...DEFAULT_METRICS_CONFIG, rouge: true }),
          },
          status: { S: 'running' },
          progress: { N: '55' },
          current_model: { S: 'anthropic.claude-3-5-sonnet' },
          samples_processed: { N: '5' },
          total_samples: { N: '10' },
          created_at: { S: '2024-01-01T00:00:00Z' },
          updated_at: { S: '2024-01-02T00:00:00Z' },
          completed_at: { S: '2024-01-03T00:00:00Z' },
          model_results: {
            S: JSON.stringify([
              {
                identifier: 'anthropic.claude-3-5-sonnet',
                metrics: {
                  latency: {
                    tokens_per_second: 100,
                    time_to_first_token_ms: 50,
                    total_latency_ms: 500,
                  },
                  cost: {
                    total_usd: 0.01,
                    input_tokens: 100,
                    output_tokens: 50,
                  },
                },
                status: 'completed',
              },
            ]),
          },
          recommendation: {
            S: JSON.stringify({
              model_identifier: 'anthropic.claude-3-5-sonnet',
              weighted_score: 0.9,
              reasoning: 'Best overall score',
            }),
          },
        },
      });

      const job = await repository.getEvaluation('eval-1');

      expect(job).toEqual({
        evaluation_id: 'eval-1',
        dataset_id: 'dataset-1',
        models: [{ type: 'custom', identifier: 'anthropic.claude-3-5-sonnet' }],
        weights: { accuracy: 0.5, latency: 0.3, cost: 0.2 },
        metrics: { ...DEFAULT_METRICS_CONFIG, rouge: true },
        status: 'running',
        progress: 55,
        current_model: 'anthropic.claude-3-5-sonnet',
        samples_processed: 5,
        total_samples: 10,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        completed_at: '2024-01-03T00:00:00Z',
        model_results: [
          {
            identifier: 'anthropic.claude-3-5-sonnet',
            metrics: {
              latency: {
                tokens_per_second: 100,
                time_to_first_token_ms: 50,
                total_latency_ms: 500,
              },
              cost: { total_usd: 0.01, input_tokens: 100, output_tokens: 50 },
            },
            status: 'completed',
          },
        ],
        recommendation: {
          model_identifier: 'anthropic.claude-3-5-sonnet',
          weighted_score: 0.9,
          reasoning: 'Best overall score',
        },
      });
    });

    it('should default metrics when the stored item has none', async () => {
      const { repository, dynamoClientMock } = setup();
      dynamoClientMock.on(GetItemCommand).resolves({
        Item: {
          evaluation_id: { S: 'eval-2' },
          dataset_id: { S: 'dataset-2' },
          models: { S: '[]' },
          weights: {
            S: JSON.stringify({ accuracy: 0.4, latency: 0.3, cost: 0.3 }),
          },
          status: { S: 'pending' },
          progress: { N: '0' },
          created_at: { S: '2024-01-01T00:00:00Z' },
          updated_at: { S: '2024-01-01T00:00:00Z' },
        },
      });

      const job = await repository.getEvaluation('eval-2');

      expect(job?.metrics).toEqual(DEFAULT_METRICS_CONFIG);
    });
  });

  describe('updateEvaluation', () => {
    it('should send an update expression for provided fields', async () => {
      const { repository, dynamoClientMock } = setup();

      await repository.updateEvaluation('eval-1', {
        status: 'failed',
        progress: 80,
        current_model: 'anthropic.claude-3-5-sonnet',
        samples_processed: 8,
        total_samples: 10,
        error_message: 'Task crashed',
      });

      expect(dynamoClientMock.commandCalls(UpdateItemCommand)).toHaveLength(1);
      const updateInput =
        dynamoClientMock.commandCalls(UpdateItemCommand)[0].args[0].input;
      expect(updateInput).toMatchObject({
        TableName: 'evaluation-jobs-test',
        Key: { evaluation_id: { S: 'eval-1' } },
        ExpressionAttributeNames: {
          '#updated_at': 'updated_at',
          '#status': 'status',
          '#progress': 'progress',
          '#current_model': 'current_model',
          '#samples_processed': 'samples_processed',
          '#total_samples': 'total_samples',
          '#error_message': 'error_message',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'failed' },
          ':progress': { N: '80' },
          ':current_model': { S: 'anthropic.claude-3-5-sonnet' },
          ':samples_processed': { N: '8' },
          ':total_samples': { N: '10' },
          ':error_message': { S: 'Task crashed' },
        },
      });
      expect(updateInput.UpdateExpression).toContain(
        '#updated_at = :updated_at',
      );
      expect(updateInput.UpdateExpression).toContain('#status = :status');
    });
  });
});

const setup = () => {
  reset();
  registerTestInfrastructue();

  process.env.DYNAMODB_TABLE = 'evaluation-jobs-test';
  const dynamoClientMock = mockClient(inject(tokenClientDynamoDB));

  return {
    repository: new EvaluationJobsRepositoryImpl(),
    dynamoClientMock,
  };
};
