import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z, ZodRawShape } from 'zod';

import { METRIC_KEYS } from '../../models/Evaluation';
import { tokenEvaluationLaunchUseCase } from '../../useCases/EvaluationLaunch/EvaluationLaunchUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';
import { parseApiEvent } from '../api/parseApiEvent';

const MetricsConfigSchema = z
  .object(
    Object.fromEntries(
      METRIC_KEYS.map((key) => [key, z.boolean().optional()]),
    ) as ZodRawShape,
  )
  .optional();

const EvaluationRequestSchema = z.object({
  dataset_id: z.string().min(1),
  models: z
    .array(
      z.object({
        identifier: z.string().min(1),
      }),
    )
    .min(1),
  weights: z
    .object({
      accuracy: z.number().optional(),
      latency: z.number().optional(),
      cost: z.number().optional(),
    })
    .optional(),
  metrics: MetricsConfigSchema,
});

export class EvaluationLaunchAdapter {
  private readonly useCase = inject(tokenEvaluationLaunchUseCase);

  public async handle(
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyResultV2> {
    return handleHttpRequest({
      event,
      func: this.processRequest.bind(this),
    });
  }

  private async processRequest(event: APIGatewayProxyEventV2) {
    const { body } = parseApiEvent(event, {
      bodySchema: EvaluationRequestSchema,
    });

    const job = await this.useCase.launchEvaluation(body);

    return {
      evaluation_id: job.evaluation_id,
      status: job.status,
      created_at: job.created_at,
    };
  }
}
