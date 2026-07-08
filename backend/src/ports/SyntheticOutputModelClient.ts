import { createInjectionToken } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../errors';

export interface SyntheticOutputModelClient {
  generate(
    request: SyntheticOutputModelRequest,
  ): Promise<SyntheticOutputModelResult>;
}

export interface SyntheticOutputModelRequest {
  prompt: string;
  modelId?: string;
}

export interface SyntheticOutputModelResult {
  output: string;
  modelId?: string;
}

export class UnconfiguredSyntheticOutputModelClient implements SyntheticOutputModelClient {
  async generate(): Promise<SyntheticOutputModelResult> {
    throw new BasicError(
      BasicErrorType.SERVICE_UNAVAILABLE,
      'SYNTHETIC_MODEL_CLIENT_NOT_CONFIGURED',
      'Synthetic output model client is not configured',
      'A real Bedrock-backed SyntheticOutputModelClient has not been implemented yet',
    );
  }
}

export const tokenSyntheticOutputModelClient =
  createInjectionToken<SyntheticOutputModelClient>(
    'SyntheticOutputModelClient',
    {
      useClass: UnconfiguredSyntheticOutputModelClient,
    },
  );
