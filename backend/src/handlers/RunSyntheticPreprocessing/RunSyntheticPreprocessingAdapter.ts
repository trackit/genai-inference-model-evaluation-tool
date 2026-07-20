import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z } from 'zod';

import { tokenRunSyntheticPreprocessingUseCase } from '../../useCases/RunSyntheticPreprocessing/RunSyntheticPreprocessingUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';
import { parseApiEvent } from '../api/parseApiEvent';

const RunSyntheticPreprocessingPathSchema = z.object({
  datasetId: z.string().min(1),
});

const RunSyntheticPreprocessingBodySchema = z.object({
  convertedDatasetArtifactKey: z.string().min(1),
  taskType: z.enum(['summarization', 'classification']),
  modelId: z.string().min(1).optional(),
});

export class RunSyntheticPreprocessingAdapter {
  private readonly useCase = inject(tokenRunSyntheticPreprocessingUseCase);

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
      pathSchema: RunSyntheticPreprocessingPathSchema,
      bodySchema: RunSyntheticPreprocessingBodySchema,
    });

    return this.useCase.runSyntheticPreprocessing({
      datasetId: pathParameters.datasetId,
      convertedDatasetArtifactKey: body.convertedDatasetArtifactKey,
      taskType: body.taskType,
      modelId: body.modelId,
    });
  }
}
