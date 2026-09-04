import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it } from 'vitest';

import { ConvertedDatasetRow } from '../../models/SyntheticOutput';
import {
  PermanentModelError,
  TransientModelError,
} from '../../services/SyntheticOutputModelClient/classifyModelError';
import { tokenFakeSyntheticOutputModelClient } from '../../services/SyntheticOutputModelClient/FakeSyntheticOutputModelClient';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { GenerateSyntheticOutputRowUseCaseImpl } from './GenerateSyntheticOutputRowUseCase';

describe('GenerateSyntheticOutputRowUseCase', () => {
  it('generates a completed row for a summarization task', async () => {
    const { fakeModelClient, useCase } = setup();
    fakeModelClient.queueOutput('Summary one');

    const row = await useCase.execute({
      convertedRow: summarizationRow(),
      taskType: 'summarization',
      modelId: 'test-model',
    });

    expect(row).toEqual({
      chunk_id: 'demo-dataset-0',
      document_id: 'demo-dataset',
      text: 'First document chunk',
      summary: 'Summary one',
      status: 'completed',
      model_id: 'test-model',
    });
    expect(fakeModelClient.requests[0].prompt).toContain(
      'Generate a concise reference summary',
    );
    expect(fakeModelClient.requests[0].prompt).toContain(
      'First document chunk',
    );
    expect(fakeModelClient.requests[0].modelId).toBe('test-model');
  });

  it('generates a completed row with a normalized class label for a classification task', async () => {
    const { fakeModelClient, useCase } = setup();
    fakeModelClient.queueOutput('Classification label: Support Policy.');

    const row = await useCase.execute({
      convertedRow: classificationRow(),
      taskType: 'classification',
    });

    expect(row).toEqual({
      chunk_id: 'demo-dataset-0',
      document_id: 'demo-dataset',
      text: 'Refunds are available after billing errors.',
      class: 'support_policy',
      status: 'completed',
      model_id: 'fake-synthetic-output-model',
    });
    expect(fakeModelClient.requests[0].prompt).toContain(
      'Generate one short canonical class label',
    );
  });

  it('throws TransientModelError when the model client throws one', async () => {
    const { fakeModelClient, useCase } = setup();
    fakeModelClient.queueError(new TransientModelError('ThrottlingException'));

    await expect(
      useCase.execute({
        convertedRow: summarizationRow(),
        taskType: 'summarization',
      }),
    ).rejects.toMatchObject({
      name: 'TransientModelError',
      originalErrorName: 'ThrottlingException',
    });
  });

  it('returns a failed row (does not throw) when the model client throws a PermanentModelError', async () => {
    const { fakeModelClient, useCase } = setup();
    fakeModelClient.queueError(new PermanentModelError('ValidationException'));

    const row = await useCase.execute({
      convertedRow: summarizationRow(),
      taskType: 'summarization',
    });

    expect(row).toEqual({
      chunk_id: 'demo-dataset-0',
      document_id: 'demo-dataset',
      text: 'First document chunk',
      status: 'failed',
      error_message: 'Permanent Bedrock error: ValidationException',
    });
  });

  it('returns a failed row when normalized output is empty', async () => {
    const { fakeModelClient, useCase } = setup();
    fakeModelClient.queueOutput('   ');

    const row = await useCase.execute({
      convertedRow: classificationRow(),
      taskType: 'classification',
    });

    expect(row).toEqual({
      chunk_id: 'demo-dataset-0',
      document_id: 'demo-dataset',
      text: 'Refunds are available after billing errors.',
      status: 'failed',
      error_message: 'Synthetic output cannot be empty',
    });
  });

  it('does not re-classify an already-classified TransientModelError (idempotency)', async () => {
    const { fakeModelClient, useCase } = setup();
    const originalError = new TransientModelError('ModelTimeoutException');
    fakeModelClient.queueError(originalError);

    await expect(
      useCase.execute({
        convertedRow: summarizationRow(),
        taskType: 'summarization',
      }),
    ).rejects.toBe(originalError);
  });

  it('does not re-classify an already-classified PermanentModelError (idempotency)', async () => {
    const { fakeModelClient, useCase } = setup();
    fakeModelClient.queueError(
      new PermanentModelError('AccessDeniedException'),
    );

    const row = await useCase.execute({
      convertedRow: summarizationRow(),
      taskType: 'summarization',
    });

    expect(row).toMatchObject({
      status: 'failed',
      error_message: 'Permanent Bedrock error: AccessDeniedException',
    });
  });
});

function setup() {
  reset();
  registerTestInfrastructure();

  return {
    fakeModelClient: inject(tokenFakeSyntheticOutputModelClient),
    useCase: new GenerateSyntheticOutputRowUseCaseImpl(),
  };
}

function summarizationRow(): ConvertedDatasetRow {
  return {
    document_id: 'demo-dataset',
    chunk_id: 'demo-dataset-0',
    document: 'First document chunk',
  };
}

function classificationRow(): ConvertedDatasetRow {
  return {
    document_id: 'demo-dataset',
    chunk_id: 'demo-dataset-0',
    document: 'Refunds are available after billing errors.',
  };
}
