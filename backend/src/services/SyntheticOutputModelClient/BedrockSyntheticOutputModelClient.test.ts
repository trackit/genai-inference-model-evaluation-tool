import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BedrockSyntheticOutputModelClient,
  tokenBedrockRuntimeClient,
} from './BedrockSyntheticOutputModelClient';

describe('BedrockSyntheticOutputModelClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('generates text through Bedrock Converse with the requested model', async () => {
    const { client, bedrockRuntimeClientMock } = setup();
    bedrockRuntimeClientMock.on(ConverseCommand).resolves({
      output: {
        message: {
          role: 'assistant',
          content: [{ text: ' Generated summary ' }],
        },
      },
    });

    const result = await client.generate({
      prompt: 'Summarize this row',
      modelId: 'test-model',
    });

    expect(result).toEqual({
      output: 'Generated summary',
      modelId: 'test-model',
    });
    expect(
      bedrockRuntimeClientMock.commandCalls(ConverseCommand)[0].args[0].input,
    ).toMatchObject({
      modelId: 'test-model',
      messages: [
        {
          role: 'user',
          content: [{ text: 'Summarize this row' }],
        },
      ],
    });
  });

  it('uses SYNTHETIC_OUTPUT_MODEL_ID when request modelId is omitted', async () => {
    vi.stubEnv('SYNTHETIC_OUTPUT_MODEL_ID', 'env-model');
    const { client, bedrockRuntimeClientMock } = setup();
    bedrockRuntimeClientMock.on(ConverseCommand).resolves({
      output: {
        message: {
          role: 'assistant',
          content: [{ text: 'class_a' }],
        },
      },
    });

    await expect(
      client.generate({ prompt: 'Classify this row' }),
    ).resolves.toEqual({
      output: 'class_a',
      modelId: 'env-model',
    });
  });

  it('falls back to a default Nova model when no modelId is configured', async () => {
    const { client, bedrockRuntimeClientMock } = setup();
    bedrockRuntimeClientMock.on(ConverseCommand).resolves({
      output: {
        message: {
          role: 'assistant',
          content: [{ text: 'default output' }],
        },
      },
    });

    await expect(client.generate({ prompt: 'Prompt' })).resolves.toEqual({
      output: 'default output',
      modelId: 'us.amazon.nova-micro-v1:0',
    });
  });

  it('rejects empty Bedrock responses', async () => {
    const { client, bedrockRuntimeClientMock } = setup();
    bedrockRuntimeClientMock.on(ConverseCommand).resolves({
      output: {
        message: {
          role: 'assistant',
          content: [{ text: '   ' }],
        },
      },
    });

    await expect(client.generate({ prompt: 'Prompt' })).rejects.toMatchObject({
      code: 'EMPTY_BEDROCK_SYNTHETIC_OUTPUT',
    });
  });

  it('maps Bedrock failures to a service unavailable BasicError', async () => {
    const { client, bedrockRuntimeClientMock } = setup();
    bedrockRuntimeClientMock
      .on(ConverseCommand)
      .rejects(new Error('access denied'));

    await expect(client.generate({ prompt: 'Prompt' })).rejects.toMatchObject({
      type: 'SERVICE_UNAVAILABLE',
      code: 'BEDROCK_SYNTHETIC_OUTPUT_GENERATION_FAILED',
      description: 'access denied',
    });
  });
});

const setup = () => {
  reset();
  const bedrockRuntimeClientMock = mockClient(
    inject(tokenBedrockRuntimeClient),
  );

  return {
    client: new BedrockSyntheticOutputModelClient(),
    bedrockRuntimeClientMock,
  };
};
