import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z } from 'zod';

import { tokenInitializeDatasetUploadUseCase } from '../../useCases/InitializeDatasetUpload/InitializeDatasetUploadUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';
import { parseApiEvent } from '../api/parseApiEvent';

const InitializeDatasetUploadBodySchema = z.object({
  filename: z.string().min(1),
});

export class InitializeDatasetUploadAdapter {
  private readonly useCase = inject(tokenInitializeDatasetUploadUseCase);

  public async handle(
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyResultV2> {
    return handleHttpRequest({
      event,
      func: this.processRequest.bind(this),
      statusCode: 201,
    });
  }

  private async processRequest(event: APIGatewayProxyEventV2) {
    const { body } = parseApiEvent(event, {
      bodySchema: InitializeDatasetUploadBodySchema,
    });

    return this.useCase.initDatasetUpload(body.filename);
  }
}
