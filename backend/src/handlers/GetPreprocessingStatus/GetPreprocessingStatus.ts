import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { GetPreprocessingStatusAdapter } from './GetPreprocessingStatusAdapter';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> =>
  new GetPreprocessingStatusAdapter().handle(event);
