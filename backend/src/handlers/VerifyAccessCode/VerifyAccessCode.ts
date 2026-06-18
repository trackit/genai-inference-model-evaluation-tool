import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { VerifyAccessCodeAdapter } from './VerifyAccessCodeAdapter';

const adapter = new VerifyAccessCodeAdapter();

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => adapter.handle(event);
