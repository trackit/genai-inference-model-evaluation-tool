import {
  FoundationModelLifecycleStatus,
  FoundationModelSummary,
  InferenceProfileStatus,
  InferenceProfileSummary,
  InferenceProfileType,
  InferenceType,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
  ModelModality,
} from '@aws-sdk/client-bedrock';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it, vi } from 'vitest';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
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
  modelLifecycle: { status: FoundationModelLifecycleStatus.ACTIVE },
};

const mockNovaProInferenceProfile = {
  inferenceProfileId: 'us.amazon.nova-pro-v1:0',
  inferenceProfileName: 'US Amazon Nova Pro',
  inferenceProfileArn:
    'arn:aws:bedrock:us-west-2:123456789012:inference-profile/us.amazon.nova-pro-v1:0',
  models: [
    {
      modelArn:
        'arn:aws:bedrock:us-west-2::foundation-model/us.amazon.nova-pro-v1:0',
    },
  ],
  status: InferenceProfileStatus.ACTIVE,
  type: InferenceProfileType.SYSTEM_DEFINED,
} as InferenceProfileSummary;

describe('BedrockModelValidationService', () => {
  it('resolves default preset identifiers to foundation model ids before profile mapping', async () => {
    const { service, bedrockClientMock } = setup();

    bedrockClientMock.on(ListInferenceProfilesCommand).resolves({
      inferenceProfileSummaries: [
        {
          inferenceProfileName: 'US Amazon Nova Pro',
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
        } as InferenceProfileSummary,
      ],
      nextToken: undefined,
    });
    bedrockClientMock.on(ListFoundationModelsCommand).resolves({
      modelSummaries: [
        {
          ...eligibleNovaPro,
          modelArn:
            'arn:aws:bedrock:us-west-2::foundation-model/amazon.nova-pro-v1:0',
          modelId: 'amazon.nova-pro-v1:0',
        } as FoundationModelSummary,
      ],
    });

    const result = await service.resolveModelsForPersistence([
      { type: 'default', identifier: 'amazon-nova' },
    ]);

    expect(result).toEqual([
      { type: 'default', identifier: 'us.amazon.nova-pro-v1:0' },
    ]);
  });

  it('lists profiles and foundation models, maps to inference profile id, and validates TEXT + streaming', async () => {
    const { service, bedrockClientMock } = setup();

    bedrockClientMock.on(ListInferenceProfilesCommand).resolves({
      inferenceProfileSummaries: [mockNovaProInferenceProfile],
      nextToken: undefined,
    });
    bedrockClientMock.on(ListFoundationModelsCommand).resolves({
      modelSummaries: [eligibleNovaPro],
    });

    const result = await service.resolveModelsForPersistence([
      { type: 'custom', identifier: 'us.amazon.nova-pro-v1:0' },
    ]);

    const profileCalls = bedrockClientMock.commandCalls(
      ListInferenceProfilesCommand,
    );
    const foundationCalls = bedrockClientMock.commandCalls(
      ListFoundationModelsCommand,
    );
    expect(profileCalls.length).toBeGreaterThan(0);
    expect(foundationCalls).toHaveLength(1);
    expect(foundationCalls[0].args[0].input).toEqual({});
    expect(result).toEqual([
      { type: 'custom', identifier: 'us.amazon.nova-pro-v1:0' },
    ]);
  });

  it('accepts a direct foundation model id when no inference profile matches (same TEXT + streaming checks)', async () => {
    const { service, bedrockClientMock } = setup();

    bedrockClientMock.on(ListInferenceProfilesCommand).resolves({
      inferenceProfileSummaries: [],
      nextToken: undefined,
    });
    bedrockClientMock.on(ListFoundationModelsCommand).resolves({
      modelSummaries: [eligibleNovaPro],
    });

    const result = await service.resolveModelsForPersistence([
      { type: 'custom', identifier: 'us.amazon.nova-pro-v1:0' },
    ]);

    expect(result).toEqual([
      { type: 'custom', identifier: 'us.amazon.nova-pro-v1:0' },
    ]);
  });

  it('validates multiple models from one list response', async () => {
    const { service, bedrockClientMock } = setup();

    bedrockClientMock.on(ListInferenceProfilesCommand).resolves({
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
          status: InferenceProfileStatus.ACTIVE,
          type: InferenceProfileType.SYSTEM_DEFINED,
        } as InferenceProfileSummary,
      ],
      nextToken: undefined,
    });
    bedrockClientMock.on(ListFoundationModelsCommand).resolves({
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

    await service.resolveModelsForPersistence([
      { type: 'custom', identifier: 'us.amazon.nova-pro-v1:0' },
      { type: 'custom', identifier: 'us.amazon.nova-lite-v1:0' },
    ]);

    expect(
      bedrockClientMock.commandCalls(ListInferenceProfilesCommand).length,
    ).toBeGreaterThan(0);
    expect(
      bedrockClientMock.commandCalls(ListFoundationModelsCommand).length,
    ).toBeGreaterThan(0);
  });

  it('rejects custom model that exists but is not eligible (non-text)', async () => {
    const { service, bedrockClientMock } = setup();

    bedrockClientMock.on(ListInferenceProfilesCommand).resolves({
      inferenceProfileSummaries: [],
      nextToken: undefined,
    });
    bedrockClientMock.on(ListFoundationModelsCommand).resolves({
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

    await expect(
      service.resolveModelsForPersistence([
        { type: 'custom', identifier: 'vendor.image-only:0' },
      ]),
    ).rejects.toMatchObject({ code: 'INVALID_BEDROCK_MODEL' });
  });

  it('rejects custom model that exists but does not support streaming', async () => {
    const { service, bedrockClientMock } = setup();

    bedrockClientMock.on(ListInferenceProfilesCommand).resolves({
      inferenceProfileSummaries: [],
      nextToken: undefined,
    });
    bedrockClientMock.on(ListFoundationModelsCommand).resolves({
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

const setup = () => {
  reset();
  registerTestInfrastructure();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  const bedrockClientMock = mockClient(inject(tokenBedrockClient));

  return {
    service: new BedrockModelValidationServiceImpl(),
    bedrockClientMock,
  };
};
