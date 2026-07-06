import { inject, reset } from '@trackit.io/di-container';
import { tokenFakeDatasetService } from 'backend/src/services/DatasetService/FakeDatasetService';
import { describe, expect, it } from 'vitest';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';

const setup = () => {
  reset();
  registerTestInfrastructure();

  return {
    useCase: inject(),
    datasetService: inject(tokenFakeDatasetService),
  };
};
