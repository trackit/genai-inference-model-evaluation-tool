import { InferenceType, ModelModality } from '@aws-sdk/client-bedrock';
import { register, reset } from '@trackit.io/di-container';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BedrockModelValidationServiceImpl,
  tokenBedrockClient,
} from './BedrockModelValidationService';

const eligibleNovaPro = {
  modelArn:
    'arn:aws:bedrock:us-west-2::foundation-model/us.amazon.nova-pro-v1:0',
  modelId: 'us.amazon.nova-pro-v1:0',
  modelName: 'Nova Pro',
  providerName: 'Amazon',
  inputModalities: [ModelModality.TEXT],
  inferenceTypesSupported: [InferenceType.ON_DEMAND],
  responseStreamingSupported: true,
  modelLifecycle: { status: 'ACTIVE' },
};

const mockNovaProInferenceProfile = {
  inferenceProfileId: 'us.amazon.nova-pro-v1:0',
  inferenceProfileArn:
    'arn:aws:bedrock:us-west-2:123456789012:inference-profile/us.amazon.nova-pro-v1:0',
  models: [
    {
      modelArn:
        'arn:aws:bedrock:us-west-2::foundation-model/us.amazon.nova-pro-v1:0',
    },
  ],
  status: 'ACTIVE',
  type: 'SYSTEM_DEFINED',
};

describe('BedrockModelValidationService', () => {
  let send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reset();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    send = vi
      .fn()
      .mockImplementation((cmd: { constructor: { name: string } }) => {
        const name = cmd.constructor.name;
        if (name === 'ListInferenceProfilesCommand') {
          return Promise.resolve({
            inferenceProfileSummaries: [mockNovaProInferenceProfile],
            nextToken: undefined,
          });
        }
        if (name === 'ListFoundationModelsCommand') {
          return Promise.resolve({ modelSummaries: [eligibleNovaPro] });
        }
        return Promise.reject(new Error(`unexpected command: ${name}`));
      });
    register(tokenBedrockClient, {
      useValue: { send } as never,
    });
  });

  it('resolves default preset identifiers to foundation model ids before profile mapping', async () => {
    send.mockImplementation((cmd: { constructor: { name: string } }) => {
      const name = cmd.constructor.name;
      if (name === 'ListInferenceProfilesCommand') {
        return Promise.resolve({
          inferenceProfileSummaries: [
            {
              inferenceProfileId: 'us.amazon.nova-pro-v1:0',
              inferenceProfileArn:
                'arn:aws:bedrock:us-west-2:123456789012:inference-profile/us.amazon.nova-pro-v1:0',
              models: [
                {
                  modelArn:
                    'arn:aws:bedrock:us-west-2::foundation-model/amazon.nova-pro-v1:0',
                },
              ],
              status: 'ACTIVE',
              type: 'SYSTEM_DEFINED',
            },
          ],
          nextToken: undefined,
        });
      }
      if (name === 'ListFoundationModelsCommand') {
        return Promise.resolve({
          modelSummaries: [
            {
              ...eligibleNovaPro,
              modelArn:
                'arn:aws:bedrock:us-west-2::foundation-model/amazon.nova-pro-v1:0',
              modelId: 'amazon.nova-pro-v1:0',
            },
          ],
        });
      }
      return Promise.reject(new Error(`unexpected command: ${name}`));
    });
    const service = new BedrockModelValidationServiceImpl();
    const result = await service.resolveModelsForPersistence([
      { type: 'default', identifier: 'amazon-nova' },
    ]);
    expect(result).toEqual([
      { type: 'default', identifier: 'us.amazon.nova-pro-v1:0' },
    ]);
  });

  it('lists profiles and foundation models, maps to inference profile id, and validates TEXT + streaming', async () => {
    const service = new BedrockModelValidationServiceImpl();
    const result = await service.resolveModelsForPersistence([
      { type: 'custom', identifier: 'us.amazon.nova-pro-v1:0' },
    ]);

    const commandNames = send.mock.calls.map((c) => c[0].constructor.name);
    expect(commandNames[0]).toBe('ListInferenceProfilesCommand');
    expect(commandNames).toContain('ListFoundationModelsCommand');
    const foundationCall = send.mock.calls.find(
      (c) => c[0].constructor.name === 'ListFoundationModelsCommand',
    );
    expect(foundationCall?.[0].input).toEqual({});
    expect(result).toEqual([
      { type: 'custom', identifier: 'us.amazon.nova-pro-v1:0' },
    ]);
  });

  it('accepts a direct foundation model id when no inference profile matches (same TEXT + streaming checks)', async () => {
    send.mockImplementation((cmd: { constructor: { name: string } }) => {
      const name = cmd.constructor.name;
      if (name === 'ListInferenceProfilesCommand') {
        return Promise.resolve({
          inferenceProfileSummaries: [],
          nextToken: undefined,
        });
      }
      if (name === 'ListFoundationModelsCommand') {
        return Promise.resolve({ modelSummaries: [eligibleNovaPro] });
      }
      return Promise.reject(new Error(`unexpected command: ${name}`));
    });
    const service = new BedrockModelValidationServiceImpl();
    const result = await service.resolveModelsForPersistence([
      { type: 'custom', identifier: 'us.amazon.nova-pro-v1:0' },
    ]);
    expect(result).toEqual([
      { type: 'custom', identifier: 'us.amazon.nova-pro-v1:0' },
    ]);
  });

  it('validates multiple models from one list response', async () => {
    send.mockImplementation((cmd: { constructor: { name: string } }) => {
      const name = cmd.constructor.name;
      if (name === 'ListInferenceProfilesCommand') {
        return Promise.resolve({
          inferenceProfileSummaries: [
            mockNovaProInferenceProfile,
            {
              inferenceProfileId: 'us.amazon.nova-lite-v1:0',
              inferenceProfileArn:
                'arn:aws:bedrock:us-west-2:123456789012:inference-profile/us.amazon.nova-lite-v1:0',
              models: [
                {
                  modelArn:
                    'arn:aws:bedrock:us-west-2::foundation-model/us.amazon.nova-lite-v1:0',
                },
              ],
              status: 'ACTIVE',
              type: 'SYSTEM_DEFINED',
            },
          ],
          nextToken: undefined,
        });
      }
      if (name === 'ListFoundationModelsCommand') {
        return Promise.resolve({
          modelSummaries: [
            eligibleNovaPro,
            {
              modelArn: 'arn2',
              modelId: 'us.amazon.nova-lite-v1:0',
              modelLifecycle: { status: 'ACTIVE' },
              inputModalities: [ModelModality.TEXT],
              inferenceTypesSupported: [InferenceType.ON_DEMAND],
              responseStreamingSupported: true,
            },
          ],
        });
      }
      return Promise.reject(new Error(`unexpected command: ${name}`));
    });
    const service = new BedrockModelValidationServiceImpl();
    await service.resolveModelsForPersistence([
      { type: 'custom', identifier: 'us.amazon.nova-pro-v1:0' },
      { type: 'custom', identifier: 'us.amazon.nova-lite-v1:0' },
    ]);

    expect(send).toHaveBeenCalled();
  });

  it('rejects custom model that exists but is not eligible (non-text)', async () => {
    send.mockImplementation((cmd: { constructor: { name: string } }) => {
      const name = cmd.constructor.name;
      if (name === 'ListInferenceProfilesCommand') {
        return Promise.resolve({
          inferenceProfileSummaries: [],
          nextToken: undefined,
        });
      }
      if (name === 'ListFoundationModelsCommand') {
        return Promise.resolve({
          modelSummaries: [
            {
              modelArn: 'arn',
              modelId: 'vendor.image-only:0',
              modelLifecycle: { status: 'ACTIVE' },
              inputModalities: [ModelModality.IMAGE],
              inferenceTypesSupported: [InferenceType.ON_DEMAND],
              responseStreamingSupported: true,
            },
            {
              modelArn: 'arn2',
              modelId: 'us.amazon.nova-lite-v1:0',
              modelLifecycle: { status: 'ACTIVE' },
              inputModalities: [ModelModality.TEXT],
              inferenceTypesSupported: [InferenceType.ON_DEMAND],
              responseStreamingSupported: true,
            },
          ],
        });
      }
      return Promise.reject(new Error(`unexpected command: ${name}`));
    });
    const service = new BedrockModelValidationServiceImpl();
    await expect(
      service.resolveModelsForPersistence([
        { type: 'custom', identifier: 'vendor.image-only:0' },
      ]),
    ).rejects.toMatchObject({ code: 'INVALID_BEDROCK_MODEL' });
  });

  it('rejects custom model that exists but does not support streaming', async () => {
    send.mockImplementation((cmd: { constructor: { name: string } }) => {
      const name = cmd.constructor.name;
      if (name === 'ListInferenceProfilesCommand') {
        return Promise.resolve({
          inferenceProfileSummaries: [],
          nextToken: undefined,
        });
      }
      if (name === 'ListFoundationModelsCommand') {
        return Promise.resolve({
          modelSummaries: [
            {
              modelArn: 'arn',
              modelId: 'stability.stable-image-style-guide-v1:0',
              modelLifecycle: { status: 'ACTIVE' },
              inputModalities: [ModelModality.TEXT],
              inferenceTypesSupported: [InferenceType.ON_DEMAND],
              responseStreamingSupported: false,
            },
          ],
        });
      }
      return Promise.reject(new Error(`unexpected command: ${name}`));
    });
    const service = new BedrockModelValidationServiceImpl();
    await expect(
      service.resolveModelsForPersistence([
        {
          type: 'custom',
          identifier: 'stability.stable-image-style-guide-v1:0',
        },
      ]),
    ).rejects.toMatchObject({ code: 'INVALID_BEDROCK_MODEL' });
  });
});
