import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z } from 'zod';

import { tokenGetPreprocessingStatusUseCase } from '../../useCases/GetPreprocessingStatus/GetPreprocessingStatusUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';
import { parseApiEvent } from '../api/parseApiEvent';

const PathSchema = z.object({ datasetId: z.string().min(1) });
const QuerySchema = z.object({ executionArn: z.string().min(1) });

export class GetPreprocessingStatusAdapter {
  private readonly useCase = inject(tokenGetPreprocessingStatusUseCase);

  public async handle(
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyResultV2> {
    return handleHttpRequest({ event, func: this.processRequest.bind(this) });
  }

  private async processRequest(event: APIGatewayProxyEventV2) {
    const { queryStringParameters } = parseApiEvent(event, {
      pathSchema: PathSchema,
      querySchema: QuerySchema,
    });

    return this.useCase.execute({
      executionArn: queryStringParameters.executionArn,
    });
  }
}
