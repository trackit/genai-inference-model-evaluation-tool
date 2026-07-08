import { createInjectionToken } from '@trackit.io/di-container';

import { BedrockSyntheticOutputModelClient } from '../services/SyntheticOutputModelClient/BedrockSyntheticOutputModelClient';

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

export const tokenSyntheticOutputModelClient =
  createInjectionToken<SyntheticOutputModelClient>(
    'SyntheticOutputModelClient',
    {
      useClass: BedrockSyntheticOutputModelClient,
    },
  );
