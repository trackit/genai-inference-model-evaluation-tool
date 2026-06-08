import { inject, register } from '@trackit.io/di-container';
import { tokenBedrockModelValidationService } from '../services/BedrockModelValidationService/BedrockModelValidationService';
import { tokenFakeBedrockModelValidationService } from '../services/BedrockModelValidationService/FakeBedrockModelValidationService';
import { tokenDatasetService } from '../services/DatasetService/DatasetServiceS3';
import { tokenFakeDatasetService } from '../services/DatasetService/FakeDatasetService';
import { tokenEvaluationJobsRepository } from '../services/EvaluationJobsRepository/EvaluationJobsDynamoDBRepository';
import { tokenFakeEvaluationJobsRepository } from '../services/EvaluationJobsRepository/FakeEvaluationJobsRepository';
import { tokenFakeFargateService } from '../services/FargateService/FakeFargateService';
import { tokenFargateService } from '../services/FargateService/FargateService';

export const registerTestInfrastructue = (): void => {
  register(tokenEvaluationJobsRepository, {
    useFactory: () => inject(tokenFakeEvaluationJobsRepository),
  });
  register(tokenFargateService, {
    useFactory: () => inject(tokenFakeFargateService),
  });
  register(tokenBedrockModelValidationService, {
    useFactory: () => inject(tokenFakeBedrockModelValidationService),
  });
  register(tokenDatasetService, {
    useFactory: () => inject(tokenFakeDatasetService),
  });
};
