import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { BasicError, BasicErrorType } from '../../errors';
import { DocumentConversionRequest } from '../../models/DocumentConversion';
import { tokenDocumentConversionUseCase } from '../../useCases/DocumentConversion/DocumentConversionUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';

export class DocumentConversionAdapter {
  private readonly useCase = inject(tokenDocumentConversionUseCase);

  public async handle(
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyResultV2> {
    return handleHttpRequest({
      event,
      func: this.processRequest.bind(this),
    });
  }

  private async processRequest(event: APIGatewayProxyEventV2) {
    const request = this.parseRequest(event);
    const result = await this.useCase.execute(request);

    return {
      uncompleteDatasetFile: result.uncompleteDatasetFile,
      S3key: result.S3key,
    };
  }

  private parseRequest(event: APIGatewayProxyEventV2): DocumentConversionRequest {
    if (!event.body) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'MISSING_BODY',
        'Request body is required',
      );
    }

    let payload: unknown;

    try {
      payload = JSON.parse(event.body);
    } catch {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_BODY',
        'Request body must be valid JSON',
      );
    }

    const { datasetId, documents, chunkingStrategy } =
      payload as DocumentConversionRequest;

    if (!datasetId) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'MISSING_DATASET_ID',
        'datasetId is required',
      );
    }

    if (!Array.isArray(documents) || documents.length === 0) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_DOCUMENTS',
        'documents must be a non-empty array of document UUIDs',
      );
    }

    if (!chunkingStrategy) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'MISSING_CHUNKING_STRATEGY',
        'chunkingStrategy is required',
      );
    }

    return { datasetId, documents, chunkingStrategy };
  }
}
