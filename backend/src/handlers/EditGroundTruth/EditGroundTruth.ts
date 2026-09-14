import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { EditGroundTruthAdapter } from './EditGroundTruthAdapter';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> =>
  new EditGroundTruthAdapter().handle(event);
