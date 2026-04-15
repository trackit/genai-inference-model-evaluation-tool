import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
  ModelModality,
  ThrottlingException,
  type FoundationModelSummary,
  type InferenceProfileSummary,
} from '@aws-sdk/client-bedrock';
import { createInjectionToken, inject } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import type { ModelConfig } from '../../models/Evaluation';
import {
  MOCK_FOUNDATION_SUMMARIES_FOR_TESTS,
  MOCK_INFERENCE_PROFILES_FOR_TESTS,
} from './mockFoundationSummariesForTests';

export type BedrockModelValidationService = {
  resolveModelsForPersistence(models: ModelConfig[]): Promise<ModelConfig[]>;
};

export const tokenBedrockClient = createInjectionToken<BedrockClient>(
  'BedrockClient',
  { useClass: BedrockClient },
);

const LIST_PAGE_SIZE = 200;

async function listAllInferenceProfileSummaries(
  client: BedrockClient,
): Promise<InferenceProfileSummary[]> {
  const out: InferenceProfileSummary[] = [];
  let nextToken: string | undefined;
  do {
    const page = await client.send(
      new ListInferenceProfilesCommand({
        maxResults: LIST_PAGE_SIZE,
        nextToken,
      }),
    );
    out.push(...(page.inferenceProfileSummaries ?? []));
    nextToken = page.nextToken;
  } while (nextToken);
  return out;
}

const TARGET_REGION = process.env.AWS_REGION ?? 'us-west-2';

function regionFromArn(arn: string): string | null {
  const parts = arn.split(':');
  return parts.length >= 4 ? parts[3] : null;
}

function foundationIdFromArn(arn: string): string | null {
  const last = arn.lastIndexOf('/');
  if (last < 0 || last >= arn.length - 1) {
    return null;
  }
  const id = arn.slice(last + 1).trim();
  return id || null;
}

function foundationModelIdForProfile(
  profile: InferenceProfileSummary,
  targetRegion: string,
): string | null {
  const arns = (profile.models ?? [])
    .map((m) => m.modelArn)
    .filter((a): a is string => !!a?.trim());

  const preferRegion = arns.filter(
    (arn) => regionFromArn(arn) === targetRegion,
  );
  const ordered = preferRegion.length > 0 ? preferRegion : arns;

  for (const arn of ordered) {
    const id = foundationIdFromArn(arn);
    if (id) {
      return id;
    }
  }
  return null;
}

function mapToInferenceProfileIds(
  models: ModelConfig[],
  profiles: InferenceProfileSummary[],
): ModelConfig[] {
  const profileByFoundationId = new Map<string, InferenceProfileSummary>();
  const profileById = new Map<string, InferenceProfileSummary>();

  for (const p of profiles) {
    if (p.inferenceProfileId) {
      profileById.set(p.inferenceProfileId, p);
    }
    for (const m of p.models ?? []) {
      const fid = foundationIdFromArn(m.modelArn ?? '');
      if (fid && !profileByFoundationId.has(fid)) {
        profileByFoundationId.set(fid, p);
      }
    }
  }

  return models.map((m) => {
    const id = m.identifier;

    const profile = profileById.get(id) ?? profileByFoundationId.get(id);
    if (!profile) {
      console.warn(
        `[BedrockModelValidation] No inference profile found for "${id}", keeping as-is.`,
      );
      return m;
    }

    const hasTargetRegion = (profile.models ?? []).some(
      (pm) => regionFromArn(pm.modelArn ?? '') === TARGET_REGION,
    );
    if (!hasTargetRegion) {
      console.warn(
        `[BedrockModelValidation] Inference profile "${profile.inferenceProfileId}" (for "${id}") has no model in ${TARGET_REGION}, keeping original identifier.`,
      );
      return m;
    }

    const profileId = profile.inferenceProfileId as string;
    if (profileId !== id) {
      console.info(
        `[BedrockModelValidation] "${id}" → inference profile "${profileId}"`,
      );
    }
    return { type: m.type, identifier: profileId };
  });
}

function isActiveModel(s: FoundationModelSummary): boolean {
  return (
    (s.modelLifecycle?.status === 'ACTIVE' ||
      s.modelLifecycle?.status === 'LEGACY') &&
    !!s.modelId?.trim()
  );
}

function supportsTextInput(s: FoundationModelSummary): boolean {
  const modalities = s.inputModalities;
  if (!modalities?.length) {
    return true;
  }
  return modalities.some((m) => String(m).toUpperCase() === ModelModality.TEXT);
}

function supportsConverseStreaming(s: FoundationModelSummary): boolean {
  return s.responseStreamingSupported === true;
}

function validateResolvedModelsAgainstFoundationCatalog(
  models: ModelConfig[],
  profiles: InferenceProfileSummary[],
  summaries: FoundationModelSummary[],
): void {
  const profileById = new Map<string, InferenceProfileSummary>();
  for (const p of profiles) {
    if (p.inferenceProfileId) {
      profileById.set(p.inferenceProfileId, p);
    }
  }
  const summaryById = new Map(
    (summaries ?? [])
      .filter((s) => !!s.modelId?.trim())
      .map((s) => [s.modelId as string, s] as const),
  );

  for (const m of models) {
    const id = m.identifier.trim();
    const profile = profileById.get(id);

    let foundationId: string;
    if (profile) {
      const fid = foundationModelIdForProfile(profile, TARGET_REGION);
      if (!fid) {
        console.warn(
          `[BedrockModelValidation] Inference profile "${id}" has no parsable foundation model ARN.`,
        );
        throw new BasicError(
          BasicErrorType.BAD_REQUEST,
          'INVALID_BEDROCK_MODEL',
          `Inference profile "${id}" has no foundation model ARNs.`,
        );
      }
      foundationId = fid;
    } else {
      foundationId = id;
    }

    const summary = summaryById.get(foundationId);
    if (!summary) {
      console.warn(
        `[BedrockModelValidation] Foundation model "${foundationId}" not in catalog (requested as "${id}").`,
      );
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_BEDROCK_MODEL',
        `Unknown Bedrock foundation model id for this Region: ${foundationId}`,
      );
    }

    if (!isActiveModel(summary)) {
      console.warn(
        `[BedrockModelValidation] Foundation model "${foundationId}" is not ACTIVE/LEGACY.`,
      );
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_BEDROCK_MODEL',
        `Model "${foundationId}" is not available for evaluation.`,
      );
    }

    if (!supportsTextInput(summary)) {
      console.warn(
        `[BedrockModelValidation] Foundation model "${foundationId}" does not support TEXT input for "${id}" (inputModalities=${JSON.stringify(summary.inputModalities)}).`,
      );
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_BEDROCK_MODEL',
        `Model "${foundationId}" does not support text input for Converse evaluation.`,
      );
    }

    if (!supportsConverseStreaming(summary)) {
      console.warn(
        `[BedrockModelValidation] Foundation model "${foundationId}" does not support response streaming for "${id}".`,
      );
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_BEDROCK_MODEL',
        `Model "${foundationId}" is not eligible for Converse streaming evaluation.`,
      );
    }
  }
}

function filterEligibleSummaries(
  summaries: FoundationModelSummary[],
): FoundationModelSummary[] {
  return summaries.filter(
    (summary) =>
      isActiveModel(summary) &&
      supportsConverseStreaming(summary) &&
      supportsTextInput(summary),
  );
}

const DEFAULT_PRESET_MATCHERS: Record<
  string,
  (s: FoundationModelSummary) => boolean
> = {
  'amazon-nova': (s) => {
    const id = s.modelId ?? '';
    return (
      id.includes('nova-pro') &&
      !id.includes('nova-lite') &&
      !id.includes('nova-micro')
    );
  },
  'amazon-nova-lite': (s) => (s.modelId ?? '').includes('nova-lite'),
  'amazon-nova-micro': (s) => (s.modelId ?? '').includes('nova-micro'),
  'claude-sonnet': (s) => {
    const id = s.modelId ?? '';
    return id.includes('anthropic') && id.includes('sonnet');
  },
  'claude-opus': (s) => {
    const id = s.modelId ?? '';
    return id.includes('anthropic') && id.includes('opus');
  },
};

function pickSingleMatch(
  presetKey: string,
  matches: FoundationModelSummary[],
): FoundationModelSummary {
  if (matches.length === 0) {
    throw new BasicError(
      BasicErrorType.BAD_REQUEST,
      'INVALID_BEDROCK_MODEL',
      `No eligible Bedrock foundation model found for preset "${presetKey}" in this Region (text input with streaming).`,
    );
  }
  if (matches.length > 1) {
    throw new BasicError(
      BasicErrorType.BAD_REQUEST,
      'AMBIGUOUS_MODEL_PRESET',
      `Multiple foundation models match preset "${presetKey}" in this Region. Use type "custom" with a full modelId from ListFoundationModels.`,
    );
  }
  return matches[0];
}

function resolveOneIdentifier(
  model: ModelConfig,
  summaries: FoundationModelSummary[],
): string {
  const raw = model.identifier.trim();
  summaries = filterEligibleSummaries(summaries);
  const active = (summaries ?? []).filter(isActiveModel);

  const byId = new Map(active.map((s) => [s.modelId as string, s] as const));

  if (byId.has(raw)) {
    return raw;
  }

  if (model.type === 'custom') {
    if (byId.has(raw)) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_BEDROCK_MODEL',
        `Model "${raw}" is not eligible for Converse streaming evaluation (needs text input with response streaming).`,
      );
    }
    throw new BasicError(
      BasicErrorType.BAD_REQUEST,
      'INVALID_BEDROCK_MODEL',
      `Unknown Bedrock foundation model id for this Region: ${raw}`,
    );
  }

  const matcher = DEFAULT_PRESET_MATCHERS[raw];
  if (!matcher) {
    throw new BasicError(
      BasicErrorType.BAD_REQUEST,
      'INVALID_MODEL_IDENTIFIER',
      `Invalid default model identifier: ${raw}`,
    );
  }

  const matches = active.filter(matcher);
  return pickSingleMatch(raw, matches).modelId as string;
}

function resolveModelsFromSummaries(
  models: ModelConfig[],
  summaries: FoundationModelSummary[],
): ModelConfig[] {
  const byId = new Map(
    (summaries ?? [])
      .filter((s) => !!s.modelId?.trim())
      .map((s) => [s.modelId as string, s] as const),
  );

  const out: ModelConfig[] = [];
  for (const m of models) {
    const resolvedId = resolveOneIdentifier(m, summaries);
    const summary = byId.get(resolvedId);
    if (!summary) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_BEDROCK_MODEL',
        `Resolved model id missing from catalog: ${resolvedId}`,
      );
    }
    if (!supportsTextInput(summary)) {
      console.warn(
        `[BedrockModelValidation] Ignoring "${resolvedId}" (requested as "${m.identifier.trim()}"): no TEXT in inputModalities ${JSON.stringify(summary.inputModalities)}.`,
      );
      continue;
    }
    out.push({ type: m.type, identifier: resolvedId });
  }

  if (out.length === 0 && models.length > 0) {
    throw new BasicError(
      BasicErrorType.BAD_REQUEST,
      'NO_TEXT_CAPABLE_MODELS',
      'Every requested model was ignored because none support text input (FoundationModelSummary.inputModalities does not include TEXT).',
    );
  }
  return out;
}

export class BedrockModelValidationServiceImpl implements BedrockModelValidationService {
  private readonly client = inject(tokenBedrockClient);

  async resolveModelsForPersistence(
    models: ModelConfig[],
  ): Promise<ModelConfig[]> {
    try {
      const inferenceProfiles = await listAllInferenceProfileSummaries(
        this.client,
      );
      const response = await this.client.send(
        new ListFoundationModelsCommand({}),
      );
      const summaries = response.modelSummaries ?? [];
      console.info(
        `[BedrockModelValidation] profiles=${inferenceProfiles.length} foundationSummaries=${summaries.length}`,
      );
      const finalModels = mapToInferenceProfileIds(models, inferenceProfiles);
      validateResolvedModelsAgainstFoundationCatalog(
        finalModels,
        inferenceProfiles,
        summaries,
      );
      console.info(
        `[BedrockModelValidation] resolved: ${JSON.stringify(finalModels)}`,
      );
      return finalModels;
    } catch (e: unknown) {
      if (e instanceof ThrottlingException) {
        throw new BasicError(
          BasicErrorType.SERVICE_UNAVAILABLE,
          'BEDROCK_THROTTLED',
          'Amazon Bedrock is throttling ListFoundationModels or ListInferenceProfiles; retry shortly.',
        );
      }
      throw e;
    }
  }
}

export class FakeBedrockModelValidationService implements BedrockModelValidationService {
  async resolveModelsForPersistence(
    models: ModelConfig[],
  ): Promise<ModelConfig[]> {
    const resolvedToFoundation = resolveModelsFromSummaries(
      models,
      MOCK_FOUNDATION_SUMMARIES_FOR_TESTS,
    );
    const mapped = mapToInferenceProfileIds(
      resolvedToFoundation,
      MOCK_INFERENCE_PROFILES_FOR_TESTS,
    );
    validateResolvedModelsAgainstFoundationCatalog(
      mapped,
      MOCK_INFERENCE_PROFILES_FOR_TESTS,
      MOCK_FOUNDATION_SUMMARIES_FOR_TESTS,
    );
    return mapped;
  }
}

export const tokenBedrockModelValidationService =
  createInjectionToken<BedrockModelValidationService>(
    'BedrockModelValidationService',
    { useClass: BedrockModelValidationServiceImpl },
  );
