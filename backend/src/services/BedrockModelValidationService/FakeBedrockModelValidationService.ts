import { createInjectionToken } from '@trackit.io/di-container';
import type { BedrockModelValidationService } from '../../ports/ModelValidationService';
import {
  mapToInferenceProfileIds,
  resolveModelsFromSummaries,
  validateResolvedModelsAgainstFoundationCatalog,
} from './BedrockModelValidationService';
import {
  MOCK_FOUNDATION_SUMMARIES_FOR_TESTS,
  MOCK_INFERENCE_PROFILES_FOR_TESTS,
} from './mockFoundationSummariesForTests';

export class FakeBedrockModelValidationService implements BedrockModelValidationService {
  async resolveModelsForPersistence(
    models: import('../../models/Evaluation').ModelConfig[],
  ): Promise<import('../../models/Evaluation').ModelConfig[]> {
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

export const tokenFakeBedrockModelValidationService =
  createInjectionToken<FakeBedrockModelValidationService>(
    'FakeBedrockModelValidationService',
    { useClass: FakeBedrockModelValidationService },
  );
