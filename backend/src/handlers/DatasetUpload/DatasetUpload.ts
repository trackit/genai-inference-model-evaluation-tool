import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { DatasetUploadAdapter } from './DatasetUploadAdapter';

const adapter = new DatasetUploadAdapter();

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => adapter.handle(event);
