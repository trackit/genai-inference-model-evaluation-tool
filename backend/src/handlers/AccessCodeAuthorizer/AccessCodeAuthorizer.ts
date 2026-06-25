import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerResult,
} from 'aws-lambda';
import { tokenVerifyAccessCodeUseCase } from '../../useCases/VerifyAccessCode/VerifyAccessCodeUseCase';

const verifyUseCase = inject(tokenVerifyAccessCodeUseCase);

export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2,
): Promise<APIGatewaySimpleAuthorizerResult> => {
  const headers = event.headers ?? {};
  const email = headers['x-access-email'];
  const code = headers['x-access-code'];

  if (!email || !code) {
    return { isAuthorized: false };
  }

  try {
    await verifyUseCase.verify(email, code);
    return { isAuthorized: true };
  } catch {
    return { isAuthorized: false };
  }
};
