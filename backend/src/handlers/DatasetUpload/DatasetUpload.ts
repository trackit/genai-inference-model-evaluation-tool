import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DatasetService } from '../../services/DatasetService/DatasetService';
import { DatasetUploadResponse } from '../../types/Dataset';
import { DatasetUploadUseCase } from '../../use-cases/DatasetUpload/DatasetUploadUseCase';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const bucketName = process.env.DATASET_BUCKET_NAME;
    const region = process.env.AWS_REGION || 'us-east-1';

    if (!bucketName) {
      return createErrorResponse(
        500,
        'CONFIGURATION_ERROR',
        'S3 bucket not configured',
      );
    }

    const { content, filename } = parseMultipartFormData(event);

    const datasetService = new DatasetService(bucketName, region);
    const useCase = new DatasetUploadUseCase(datasetService);

    const metadata = await useCase.execute(content, filename);

    const response: DatasetUploadResponse = {
      success: true,
      data: {
        dataset_id: metadata.dataset_id,
        sample_count: metadata.sample_count,
        has_reference_outputs: metadata.has_reference_outputs,
        has_context: metadata.has_context,
      },
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    return handleError(error);
  }
};

function parseMultipartFormData(event: APIGatewayProxyEvent): {
  content: string;
  filename: string;
} {
  const contentType =
    event.headers['content-type'] || event.headers['Content-Type'];

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

function handleError(error: unknown): APIGatewayProxyResult {
  const errorMessage =
    error instanceof Error ? error.message : 'Unknown error occurred';

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  const details: any = {};

  if (errorMessage.includes('prompt')) {
    statusCode = 400;
    errorCode = 'MISSING_PROMPT';
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
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(response),
  };
}

function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
): APIGatewayProxyResult {
  const response: DatasetUploadResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(response),
  };
}
