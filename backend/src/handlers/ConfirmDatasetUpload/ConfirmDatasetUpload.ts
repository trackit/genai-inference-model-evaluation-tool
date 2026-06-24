import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { ConfirmDatasetUploadAdapter } from './ConfirmDatasetUploadAdapter';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> =>
  new ConfirmDatasetUploadAdapter().handle(event);
