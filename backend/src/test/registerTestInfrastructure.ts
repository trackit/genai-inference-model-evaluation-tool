import { inject, register } from '@trackit.io/di-container';
import { tokenAccessCodeRepository } from '../services/AccessCodeRepository/AccessCodeRepository';
import { tokenFakeAccessCodeRepository } from '../services/AccessCodeRepository/FakeAccessCodeRepository';
import { tokenBedrockModelValidationService } from '../services/BedrockModelValidationService/BedrockModelValidationService';
import { tokenFakeBedrockModelValidationService } from '../services/BedrockModelValidationService/FakeBedrockModelValidationService';
import { tokenDatasetService } from '../services/DatasetService/DatasetServiceS3';
import { tokenFakeDatasetService } from '../services/DatasetService/FakeDatasetService';
import { tokenDocumentConversionService } from '../services/DocumentConversionService/DocumentConversionServiceS3';
import { tokenFakeDocumentConversionService } from '../services/DocumentConversionService/FakeDocumentConversionService';
import { tokenEmailService } from '../services/EmailService/EmailService';
import { tokenFakeEmailService } from '../services/EmailService/FakeEmailService';
import { tokenEvaluationJobsRepository } from '../services/EvaluationJobsRepository/EvaluationJobsDynamoDBRepository';
import { tokenFakeEvaluationJobsRepository } from '../services/EvaluationJobsRepository/FakeEvaluationJobsRepository';
import { tokenFakeFargateService } from '../services/FargateService/FakeFargateService';
import { tokenFargateService } from '../services/FargateService/FargateService';

export const registerTestInfrastructure = (): void => {
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
  register(tokenDocumentConversionService, {
    useFactory: () => inject(tokenFakeDocumentConversionService),
  });
  register(tokenEmailService, {
    useFactory: () => inject(tokenFakeEmailService),
  });
  register(tokenAccessCodeRepository, {
    useFactory: () => inject(tokenFakeAccessCodeRepository),
  });
};
