import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { z } from 'zod';

import { BasicError, BasicErrorType } from '../../errors';

type ZodSchema = z.ZodType;

function acceptsEmptyObject(schema: ZodSchema): boolean {
  return schema.safeParse({}).success;
}

export function parsePathFromEvent<P extends ZodSchema>(
  event: APIGatewayProxyEventV2,
  schema: P,
): z.infer<P> {
  const raw = event.pathParameters ?? undefined;
  if (raw == null) {
    throw new BasicError(
      BasicErrorType.BAD_REQUEST,
      'PATH_MISSING',
      'Path parameters are required',
    );
  }
  return schema.parse(raw);
}

export function parseQueryFromEvent<Q extends ZodSchema>(
  event: APIGatewayProxyEventV2,
  schema: Q,
): z.infer<Q> {
  const raw = event.queryStringParameters ?? undefined;
  if (raw == null) {
    if (acceptsEmptyObject(schema)) {
      return schema.parse({});
    }
    throw new BasicError(
      BasicErrorType.BAD_REQUEST,
      'QUERY_MISSING',
      'Query parameters are required',
    );
  }
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v != null),
  );
  return schema.parse(cleaned);
}

export function parseBodyFromEvent<B extends ZodSchema>(
  event: APIGatewayProxyEventV2,
  schema: B,
): z.infer<B> {
  const rawBody =
    event.body == null || event.body === '{}'
      ? undefined
      : event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body;

  if (rawBody == null) {
    if (acceptsEmptyObject(schema)) {
      return schema.parse({});
    }
    throw new BasicError(
      BasicErrorType.BAD_REQUEST,
      'BODY_MISSING',
      'Request body is required',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new BasicError(
      BasicErrorType.BAD_REQUEST,
      'INVALID_JSON',
      'Request body is not valid JSON',
    );
  }

  return schema.parse(parsed);
}

type InferOrUndefined<S> = S extends ZodSchema ? z.infer<S> : undefined;

export function parseApiEvent<
  P extends ZodSchema | undefined = undefined,
  Q extends ZodSchema | undefined = undefined,
  B extends ZodSchema | undefined = undefined,
>(
  event: APIGatewayProxyEventV2,
  schemas: { pathSchema?: P; querySchema?: Q; bodySchema?: B },
): {
  pathParameters: InferOrUndefined<P>;
  queryStringParameters: InferOrUndefined<Q>;
  body: InferOrUndefined<B>;
} {
  const pathParameters = schemas.pathSchema
    ? parsePathFromEvent(event, schemas.pathSchema)
    : undefined;
  const queryStringParameters = schemas.querySchema
    ? parseQueryFromEvent(event, schemas.querySchema)
    : undefined;
  const body = schemas.bodySchema
    ? parseBodyFromEvent(event, schemas.bodySchema)
    : undefined;

  return {
    pathParameters: pathParameters as InferOrUndefined<P>,
    queryStringParameters: queryStringParameters as InferOrUndefined<Q>,
    body: body as InferOrUndefined<B>,
  };
}
