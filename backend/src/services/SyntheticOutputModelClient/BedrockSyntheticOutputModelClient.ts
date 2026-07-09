import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import type {
  SyntheticOutputModelClient,
  SyntheticOutputModelRequest,
  SyntheticOutputModelResult,
} from '../../ports/SyntheticOutputModelClient';

const DEFAULT_SYNTHETIC_OUTPUT_MODEL_ID =
  'us.meta.llama4-maverick-17b-instruct-v1:0';
const MAX_OUTPUT_TOKENS = 512;
const TEMPERATURE = 0.2;

export const tokenBedrockRuntimeClient =
  createInjectionToken<BedrockRuntimeClient>('BedrockRuntimeClient', {
    useClass: BedrockRuntimeClient,
  });

export class BedrockSyntheticOutputModelClient implements SyntheticOutputModelClient {
  private readonly bedrockRuntimeClient = inject(tokenBedrockRuntimeClient);

  async generate({
    prompt,
    modelId,
  }: SyntheticOutputModelRequest): Promise<SyntheticOutputModelResult> {
    const resolvedModelId = resolveModelId(modelId);

    try {
      const response = await this.bedrockRuntimeClient.send(
        new ConverseCommand({
          modelId: resolvedModelId,
          messages: [
            {
              role: 'user',
              content: [{ text: prompt }],
            },
          ],
          inferenceConfig: {
            maxTokens: MAX_OUTPUT_TOKENS,
            temperature: TEMPERATURE,
          },
        }),
      );

      return {
        output: extractTextOutput(response),
        modelId: resolvedModelId,
      };
    } catch (error: unknown) {
      if (error instanceof BasicError) {
        throw error;
      }

      throw new BasicError(
        BasicErrorType.SERVICE_UNAVAILABLE,
        'BEDROCK_SYNTHETIC_OUTPUT_GENERATION_FAILED',
        'Bedrock synthetic output generation failed',
        error instanceof Error ? error.message : undefined,
      );
    }
  }
}

function resolveModelId(modelId: string | undefined): string {
  const resolved =
    modelId?.trim() ||
    process.env.SYNTHETIC_OUTPUT_MODEL_ID?.trim() ||
    DEFAULT_SYNTHETIC_OUTPUT_MODEL_ID;

  if (!resolved) {
    throw new BasicError(
      BasicErrorType.SERVICE_UNAVAILABLE,
      'SYNTHETIC_OUTPUT_MODEL_ID_NOT_CONFIGURED',
      'Synthetic output model ID is not configured',
      'Provide modelId in the request body or set SYNTHETIC_OUTPUT_MODEL_ID.',
    );
  }

  return resolved;
}

function extractTextOutput(response: ConverseCommandOutput): string {
  const output = response.output?.message?.content
    ?.map((contentBlock) => contentBlock.text ?? '')
    .join('')
    .trim();

  if (!output) {
    throw new BasicError(
      BasicErrorType.UNPROCESSABLE_ENTITY,
      'EMPTY_BEDROCK_SYNTHETIC_OUTPUT',
      'Bedrock returned an empty synthetic output',
    );
  }

  return output;
}
