import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z } from 'zod';

import { ChunkingStrategy } from '../../models/DocumentConversion';
import { SYNTHETIC_OUTPUT_TASK_TYPES } from '../../models/SyntheticOutput';
import { tokenStartPreprocessingUseCase } from '../../useCases/StartPreprocessing/StartPreprocessingUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';
import { parseApiEvent } from '../api/parseApiEvent';

const StartPreprocessingModulePathSchema = z.object({
  datasetId: z.string().min(1),
});

const RunSyntheticPreprocessingBodySchema = z.object({
  taskType: z.enum(SYNTHETIC_OUTPUT_TASK_TYPES),
  chunkingStrategy: z.enum(ChunkingStrategy),
});

export class StartPreprocessingAdapter {
  private readonly useCase = inject(tokenStartPreprocessingUseCase);

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
    const { pathParameters, body } = parseApiEvent(event, {
      pathSchema: StartPreprocessingModulePathSchema,
      bodySchema: RunSyntheticPreprocessingBodySchema,
    });

    return this.useCase.execute({
      datasetId: pathParameters.datasetId,
      taskType: body.taskType,
      chunkingStrategy: body.chunkingStrategy,
    });
  }
}
