import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z } from 'zod';

import { tokenGetEvaluationStatusUseCase } from '../../useCases/EvaluationStatus/GetEvaluationStatusUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';
import { parseApiEvent } from '../api/parseApiEvent';

const EvaluationStatusPathSchema = z.object({
  id: z.string().min(1),
});

export class EvaluationStatusAdapter {
  private readonly useCase = inject(tokenGetEvaluationStatusUseCase);

  public async handle(
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyResultV2> {
    return handleHttpRequest({
      event,
      func: this.processRequest.bind(this),
    });
  }

  private async processRequest(event: APIGatewayProxyEventV2) {
    const { pathParameters } = parseApiEvent(event, {
      pathSchema: EvaluationStatusPathSchema,
    });

    return this.useCase.getStatus(pathParameters.id);
  }
}
