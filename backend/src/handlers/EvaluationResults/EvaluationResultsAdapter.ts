import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z } from 'zod';

import { tokenGetEvaluationResultsUseCase } from '../../useCases/EvaluationResults/GetEvaluationResultsUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';
import { parseApiEvent } from '../api/parseApiEvent';

const EvaluationResultsPathSchema = z.object({
  id: z.string().min(1),
});

export class EvaluationResultsAdapter {
  private readonly useCase = inject(tokenGetEvaluationResultsUseCase);

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
      pathSchema: EvaluationResultsPathSchema,
    });

    return this.useCase.getResults(pathParameters.id);
  }
}
