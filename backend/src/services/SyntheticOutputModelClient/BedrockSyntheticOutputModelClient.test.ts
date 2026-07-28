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
      modelId: 'us.meta.llama4-maverick-17b-instruct-v1:0',
    });
  });

  it('classifies empty Bedrock responses as non-retryable', async () => {
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
      name: 'PermanentModelError',
      originalErrorName: 'EmptyModelOutputError',
    });
  });
});

describe('classifies Bedrock errors as retryable or non-retryable', () => {
  it.each([
    ['ThrottlingException', 'TransientModelError'],
    ['ModelTimeoutException', 'TransientModelError'],
    ['ServiceUnavailableException', 'TransientModelError'],
    ['InternalServerException', 'TransientModelError'],
    ['ModelNotReadyException', 'TransientModelError'],
    ['ValidationException', 'PermanentModelError'],
    ['AccessDeniedException', 'PermanentModelError'],
    ['ResourceNotFoundException', 'PermanentModelError'],
    ['ModelErrorException', 'PermanentModelError'],
  ])('%s -> %s', async (bedrockErrorName, expectedClassification) => {
    const { client, bedrockRuntimeClientMock } = setup();

    bedrockRuntimeClientMock.on(ConverseCommand).rejects({
      name: bedrockErrorName,
      message: `simulated ${bedrockErrorName}`,
    });

    await expect(client.generate({ prompt: 'Prompt' })).rejects.toMatchObject({
      name: expectedClassification,
      originalErrorName: bedrockErrorName,
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
