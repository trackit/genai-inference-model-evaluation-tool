import type { ModelConfig } from '../models/Evaluation';

export interface BedrockModelValidationService {
  resolveModelsForPersistence(models: ModelConfig[]): Promise<ModelConfig[]>;
}
