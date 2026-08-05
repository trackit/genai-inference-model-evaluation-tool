import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z } from 'zod';

import { tokenEditGroundTruthUseCase } from '../../useCases/EditGroundTruth/EditGroundTruthUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';
import { parseApiEvent } from '../api/parseApiEvent';

const EditGroundTruthPathSchema = z.object({
  datasetId: z.string().min(1),
});

const EditGroundTruthBodySchema = z.object({
  edits: z
    .record(z.string().uuid(), z.string().min(1))
    .refine((edits) => Object.keys(edits).length > 0, {
      message: 'At least one edit is required',
    }),
});

export class EditGroundTruthAdapter {
  private readonly useCase = inject(tokenEditGroundTruthUseCase);

  public async handle(
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyResultV2> {
    return handleHttpRequest({
      event,
      func: this.processRequest.bind(this),
      statusCode: 204,
    });
  }

  private async processRequest(event: APIGatewayProxyEventV2) {
    const { pathParameters, body } = parseApiEvent(event, {
      pathSchema: EditGroundTruthPathSchema,
      bodySchema: EditGroundTruthBodySchema,
    });

    return this.useCase.editGroundTruth({
      datasetId: pathParameters.datasetId,
      edits: body.edits,
    });
  }
}
