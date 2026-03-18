import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { EvaluationResultsAdapter } from './EvaluationResultsAdapter';

const adapter = new EvaluationResultsAdapter();

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => adapter.handle(event);
