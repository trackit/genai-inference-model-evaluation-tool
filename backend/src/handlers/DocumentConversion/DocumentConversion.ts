import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { DocumentConversionAdapter } from './DocumentConversionAdapter';

const adapter = new DocumentConversionAdapter();

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => adapter.handle(event);
