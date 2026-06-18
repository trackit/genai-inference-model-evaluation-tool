import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z } from 'zod';
import { tokenRequestAccessCodeUseCase } from '../../useCases/RequestAccessCode/RequestAccessCodeUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';
import { parseApiEvent } from '../api/parseApiEvent';

const RequestAccessCodeSchema = z.object({
  email: z.string().min(1),
});

export class RequestAccessCodeAdapter {
  private readonly useCase = inject(tokenRequestAccessCodeUseCase);

  public async handle(
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyResultV2> {
    return handleHttpRequest({
      statusCode: 202,
      event,
      func: this.processRequest.bind(this),
    });
  }

  private async processRequest(event: APIGatewayProxyEventV2) {
    const { body } = parseApiEvent(event, {
      bodySchema: RequestAccessCodeSchema,
    });
    await this.useCase.execute(body.email);
    return { message: 'Code request accepted' };
  }
}
