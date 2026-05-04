import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { BasicError, BasicErrorType } from '../../errors';
import { tokenDatasetUploadUseCase } from '../../useCases/DatasetUpload/DatasetUploadUseCase';
import { handleHttpRequest } from '../api/handleHttpRequest';

export class DatasetUploadAdapter {
  private readonly useCase = inject(tokenDatasetUploadUseCase);

  public async handle(
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyResultV2> {
    return handleHttpRequest({
      event,
      func: this.processRequest.bind(this),
    });
  }

  private async processRequest(event: APIGatewayProxyEventV2) {
    const { content, filename } = this.parseMultipartFormData(event);

    const metadata = await this.useCase.execute(content, filename);

    return {
      dataset_id: metadata.dataset_id,
      sample_count: metadata.sample_count,
      has_summary: metadata.has_summary,
      has_class: metadata.has_class,
    };
  }

  private parseMultipartFormData(event: APIGatewayProxyEventV2): {
    content: string;
    filename: string;
  } {
    const contentType = event.headers['content-type'];

    if (!contentType?.includes('multipart/form-data')) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_CONTENT_TYPE',
        'Content-Type must be multipart/form-data',
      );
    }

    const body = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf-8')
      : event.body || '';

    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_CONTENT_TYPE',
        'Missing boundary in Content-Type',
      );
    }

    const boundary = boundaryMatch[1];
    const parts = body.split(`--${boundary}`);

    let content = '';
    let filename = '';

    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data')) {
        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
          const contentStart = part.indexOf('\r\n\r\n') + 4;
          const contentEnd = part.lastIndexOf('\r\n');
          content = part.substring(contentStart, contentEnd);
        }
      }
    }

    if (!content || !filename) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'MISSING_FILE',
        'No file found in request',
      );
    }

    return { content, filename };
  }
}
