import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { GetDatasetPreviewAdapter } from './GetDatasetPreviewAdapter';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> =>
  new GetDatasetPreviewAdapter().handle(event);
