import {
  ModelModality,
  type FoundationModelSummary,
  type InferenceProfileSummary,
} from '@aws-sdk/client-bedrock';

/** Subset of ListFoundationModels output for unit tests and FakeEvaluationLaunchUseCase. */
export const MOCK_FOUNDATION_SUMMARIES_FOR_TESTS: FoundationModelSummary[] = [
  {
    modelArn:
      'arn:aws:bedrock:us-west-2::foundation-model/us.amazon.nova-pro-v1:0',
    modelId: 'us.amazon.nova-pro-v1:0',
    modelName: 'Nova Pro',
    providerName: 'Amazon',
    inputModalities: [ModelModality.TEXT],
    responseStreamingSupported: true,
    modelLifecycle: { status: 'ACTIVE' },
  },
  {
    modelArn:
      'arn:aws:bedrock:us-west-2::foundation-model/us.amazon.nova-lite-v1:0',
    modelId: 'us.amazon.nova-lite-v1:0',
    modelName: 'Nova Lite',
    providerName: 'Amazon',
    inputModalities: [ModelModality.TEXT],
    responseStreamingSupported: true,
    modelLifecycle: { status: 'ACTIVE' },
  },
  {
    modelArn:
      'arn:aws:bedrock:us-west-2::foundation-model/us.amazon.nova-micro-v1:0',
    modelId: 'us.amazon.nova-micro-v1:0',
    modelName: 'Nova Micro',
    providerName: 'Amazon',
    inputModalities: [ModelModality.TEXT],
    responseStreamingSupported: true,
    modelLifecycle: { status: 'ACTIVE' },
  },
  {
    modelArn:
      'arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    modelName: 'Claude 3.5 Sonnet',
    providerName: 'Anthropic',
    inputModalities: [ModelModality.TEXT],
    responseStreamingSupported: true,
    modelLifecycle: { status: 'ACTIVE' },
  },
  {
    modelArn:
      'arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-opus-20240229-v1:0',
    modelId: 'anthropic.claude-3-opus-20240229-v1:0',
    modelName: 'Claude 3 Opus',
    providerName: 'Anthropic',
    inputModalities: [ModelModality.TEXT],
    responseStreamingSupported: true,
    modelLifecycle: { status: 'ACTIVE' },
  },
];

/** One synthetic profile per mock foundation model (inferenceProfileId matches modelId). */
export const MOCK_INFERENCE_PROFILES_FOR_TESTS: InferenceProfileSummary[] =
  MOCK_FOUNDATION_SUMMARIES_FOR_TESTS.map((s) => ({
    inferenceProfileId: s.modelId as string,
    inferenceProfileName: s.modelName ?? (s.modelId as string),
    inferenceProfileArn: `arn:aws:bedrock:us-west-2:123456789012:inference-profile/${s.modelId}`,
    models: [{ modelArn: s.modelArn as string }],
    status: 'ACTIVE',
    type: 'SYSTEM_DEFINED',
  }));
