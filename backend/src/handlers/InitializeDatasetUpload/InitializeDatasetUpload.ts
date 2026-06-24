import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { InitializeDatasetUploadAdapter } from './InitializeDatasetUploadAdapter';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> =>
  new InitializeDatasetUploadAdapter().handle(event);
