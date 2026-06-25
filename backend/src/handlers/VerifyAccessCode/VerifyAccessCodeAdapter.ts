import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z } from 'zod';
import { tokenVerifyAccessCodeUseCase } from '../../useCases/VerifyAccessCode/VerifyAccessCodeUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';
import { parseApiEvent } from '../api/parseApiEvent';

const VerifyAccessCodeSchema = z.object({
  email: z.string().min(1),
  code: z.string().min(1),
});

export class VerifyAccessCodeAdapter {
  private readonly useCase = inject(tokenVerifyAccessCodeUseCase);

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
      bodySchema: VerifyAccessCodeSchema,
    });
    const { expiresAt } = await this.useCase.verify(body.email, body.code);
    return { valid: true, expiresAt: expiresAt.toISOString() };
  }
}
