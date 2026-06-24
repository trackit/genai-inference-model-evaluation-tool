import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { z } from 'zod';

import { BasicError, BasicErrorType } from '../../errors';

const ErrorTypeResponseCode: Record<BasicErrorType, number> = {
  [BasicErrorType.BAD_REQUEST]: 400,
  [BasicErrorType.UNPROCESSABLE_ENTITY]: 422,
  [BasicErrorType.FORBIDDEN]: 403,
  [BasicErrorType.NOT_FOUND]: 404,
  [BasicErrorType.CONFLICT]: 409,
  [BasicErrorType.SERVICE_UNAVAILABLE]: 503,
};

export const buildResponse = (
  statusCode: number,
  body: unknown = {},
  headers: Record<string, string> = {},
): APIGatewayProxyResultV2 => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

export const handleHttpRequest = async ({
  event,
  func,
  statusCode = 200,
  headers = {},
}: {
  event: APIGatewayProxyEventV2;
  func: (event: APIGatewayProxyEventV2) => Promise<unknown>;
  statusCode?: number;
  headers?: Record<string, string>;
}): Promise<APIGatewayProxyResultV2> => {
  try {
    const result = await func(event);
    return buildResponse(statusCode, { success: true, data: result }, headers);
  } catch (e: unknown) {
    if (e instanceof BasicError) {
      const httpStatus = ErrorTypeResponseCode[e.type];
      console.error(`${e.code}Error`, {
        type: e.type,
        message: e.message,
        description: e.description,
      });
      return buildResponse(httpStatus, {
        success: false,
        error: {
          code: e.code,
          message: e.message,
          ...(e.description && { description: e.description }),
        },
      });
    }

    if (e instanceof z.ZodError) {
      console.error('ValidationError', e.issues);
      return buildResponse(422, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: e.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
      });
    }

    console.error('Internal Server Error', e);
    return buildResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
      },
    });
  }
};
