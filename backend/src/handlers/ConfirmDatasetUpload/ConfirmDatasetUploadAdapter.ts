import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z } from 'zod';

import { tokenConfirmDatasetUploadUseCase } from '../../useCases/ConfirmDatasetUpload/ConfirmDatasetUploadUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';
import { parseApiEvent } from '../api/parseApiEvent';

const ConfirmDatasetUploadPathSchema = z.object({
  id: z.string().min(1),
});

const ConfirmDatasetUploadBodySchema = z.object({
  file_type: z.enum(['csv', 'jsonl']).optional(),
});

export class ConfirmDatasetUploadAdapter {
  private readonly useCase = inject(tokenConfirmDatasetUploadUseCase);

  public async handle(
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyResultV2> {
    return handleHttpRequest({
      event,
      func: this.processRequest.bind(this),
    });
  }

  private async processRequest(event: APIGatewayProxyEventV2) {
    const { pathParameters, body } = parseApiEvent(event, {
      pathSchema: ConfirmDatasetUploadPathSchema,
      bodySchema: ConfirmDatasetUploadBodySchema,
    });

    return this.useCase.confirmDatasetUpload(pathParameters.id, body.file_type);
  }
}
