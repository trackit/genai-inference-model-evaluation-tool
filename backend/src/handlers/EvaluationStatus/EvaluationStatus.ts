import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { EvaluationStatusAdapter } from './EvaluationStatusAdapter';

const adapter = new EvaluationStatusAdapter();

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => adapter.handle(event);
