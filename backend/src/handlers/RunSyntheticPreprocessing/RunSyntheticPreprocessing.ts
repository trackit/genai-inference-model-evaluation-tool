import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { RunSyntheticPreprocessingAdapter } from './RunSyntheticPreprocessingAdapter';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> =>
  new RunSyntheticPreprocessingAdapter().handle(event);
