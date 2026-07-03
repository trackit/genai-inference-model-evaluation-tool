import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z } from 'zod';

import { MAX_DATASET_BYTES, MIN_FILE_BYTES } from '../../models/Dataset';
import { tokenInitializeDatasetUploadUseCase } from '../../useCases/InitializeDatasetUpload/InitializeDatasetUploadUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';
import { parseApiEvent } from '../api/parseApiEvent';

const FileUploadRequestSchema = z.object({
  filename: z.string().min(1),
  size_bytes: z.number().int().min(MIN_FILE_BYTES).max(MAX_DATASET_BYTES),
});

const InitializeDatasetUploadBodySchema = z.object({
  files: z.array(FileUploadRequestSchema).min(1),
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

    const fileRequests = body.files.map((file) => ({
      filename: file.filename,
      size_bytes: file.size_bytes,
    }));

    return this.useCase.initDatasetUpload(fileRequests);
  }
}
