import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DatasetUploadResponse } from '../../models/Dataset';
import { tokenDatasetUploadUseCase } from '../../useCases/DatasetUpload/DatasetUploadUseCase';

const useCase = inject(tokenDatasetUploadUseCase);

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { content, filename } = parseMultipartFormData(event);

    const metadata = await useCase.execute(content, filename);

    const response: DatasetUploadResponse = {
      success: true,
      data: {
        dataset_id: metadata.dataset_id,
        sample_count: metadata.sample_count,
        has_summary: metadata.has_summary,
        has_class: metadata.has_class,
      },
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    return handleError(error);
  }
};

function parseMultipartFormData(event: APIGatewayProxyEventV2): {
  content: string;
  filename: string;
} {
  const contentType = event.headers['content-type'];

  if (!contentType?.includes('multipart/form-data')) {
    throw new Error('Content-Type must be multipart/form-data');
  }

  const body = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf-8')
    : event.body || '';

  const boundaryMatch = contentType.match(/boundary=([^;]+)/);
  if (!boundaryMatch) {
    throw new Error('Missing boundary in Content-Type');
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
    throw new Error('No file found in request');
  }

  return { content, filename };
}

function handleError(error: unknown): APIGatewayProxyResultV2 {
  const errorMessage =
    error instanceof Error ? error.message : 'Unknown error occurred';

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  const details: Record<string, unknown> = {};

  if (errorMessage.includes('document')) {
    statusCode = 400;
    errorCode = 'MISSING_DOCUMENT';
  } else if (errorMessage.includes('at least 10 samples')) {
    statusCode = 400;
    errorCode = 'TOO_SMALL';
  } else if (errorMessage.includes('exceeds maximum limit')) {
    statusCode = 400;
    errorCode = 'TOO_LARGE';
  } else if (errorMessage.includes('Invalid file format')) {
    statusCode = 400;
    errorCode = 'INVALID_FORMAT';
  } else if (errorMessage.includes('malicious content')) {
    statusCode = 400;
    errorCode = 'MALICIOUS_CONTENT';
  } else if (errorMessage.includes('parsing row')) {
    statusCode = 400;
    errorCode = 'INVALID_FORMAT';
    const rowMatch = errorMessage.match(/row (\d+)/);
    if (rowMatch) {
      details.row = parseInt(rowMatch[1]);
    }
  } else if (errorMessage.includes('parsing line')) {
    statusCode = 400;
    errorCode = 'INVALID_FORMAT';
    const lineMatch = errorMessage.match(/line (\d+)/);
    if (lineMatch) {
      details.line = parseInt(lineMatch[1]);
    }
  }

  const response: DatasetUploadResponse = {
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
      ...(Object.keys(details).length > 0 && { details }),
    },
  };

  return {
    statusCode,
    body: JSON.stringify(response),
  };
}
