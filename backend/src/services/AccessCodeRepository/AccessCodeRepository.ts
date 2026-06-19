import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { createInjectionToken, inject } from '@trackit.io/di-container';
import { AccessCodeRecord } from '../../models/AccessCode';
import type { AccessCodeRepository } from '../../ports/AccessCodeRepository';
import { tokenDynamoDBClient } from '../EvaluationJobsRepository/EvaluationJobsRepository';
export class AccessCodeRepositoryDynamoDB implements AccessCodeRepository {
  private readonly tableName = process.env.ACCESS_CODES_TABLE!;
  private readonly dynamoClient = inject(tokenAccessCodeDynamoDBClient);

  async saveCode(record: AccessCodeRecord): Promise<void> {
    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: {
          email: { S: record.email },
          code_hash: { S: record.code_hash },
          expires_at: { S: record.expires_at.toString() },
          attempts: { N: record.attempts.toString() },
          last_sent_at: { S: record.last_sent_at.toString() },
        },
      }),
    );
  }

  async getByEmail(email: string): Promise<AccessCodeRecord | null> {
    const result = await this.dynamoClient.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: { email: { S: email } },
      }),
    );

    if (!result.Item) {
      return null;
    }

    return {
      email: result.Item['email'].S ?? email,
      code_hash: result.Item['code_hash'].S ?? '',
      expires_at: new Date(result.Item['expires_at'].S ?? '0'),
      attempts: Number(result.Item['attempts'].N ?? '0'),
      last_sent_at: new Date(result.Item['last_sent_at'].S ?? '0'),
    };
  }

  async incrementAttempts(email: string): Promise<void> {
    await this.dynamoClient.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: { email: { S: email } },
        UpdateExpression:
          'SET #attempts = if_not_exists(#attempts, :zero) + :one',
        ExpressionAttributeNames: {
          '#attempts': 'attempts',
        },
        ExpressionAttributeValues: {
          ':zero': { N: '0' },
          ':one': { N: '1' },
        },
      }),
    );
  }
}

export const tokenAccessCodeRepository =
  createInjectionToken<AccessCodeRepository>('AccessCodeRepository', {
    useClass: AccessCodeRepositoryDynamoDB,
  });

export const tokenAccessCodeDynamoDBClient =
  createInjectionToken<DynamoDBClient>('AccessCodeDynamoDBClient', {
    useFactory: () => inject(tokenDynamoDBClient),
  });
