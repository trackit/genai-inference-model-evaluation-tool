import { describe, expect, it } from 'vitest';
import { inject, reset } from '@trackit.io/di-container';
import { ChunkingStrategy } from '../../models/DocumentConversion';
import { DocumentConversionUseCaseImpl, tokenDocumentConversionUseCase } from './DocumentConversionUseCase';
import { FakeDocumentConversionService } from '../../services/DocumentConversionService/FakeDocumentConversionService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { tokenDocumentConversionService } from '../../services/DocumentConversionService/DocumentConversionServiceS3';
import { randomUUID } from 'crypto';

const setup = () => {
  reset();
  registerTestInfrastructure();

  return {
    useCase: inject(tokenDocumentConversionUseCase) as DocumentConversionUseCaseImpl,
    documentConversionService: inject(tokenDocumentConversionService) as FakeDocumentConversionService,
  };
};

describe('DocumentConversionUseCase execute', () => {
  it('fetches, chunks, and generates JSONL with CHAPTER strategy', async () => {
    const { useCase, documentConversionService } = setup();

    const datasetId = randomUUID();
    const documentId1 = randomUUID();
    const documentId2 = randomUUID();
    documentConversionService.seed({
      datasetId: datasetId,
      documentId: documentId1,
      text: 'First paragraph.\n\nSecond paragraph.',
    });

    documentConversionService.seed({
      datasetId: datasetId,
      documentId: documentId2,
      text: 'Only one paragraph',
    });

    const result = await useCase.execute({
      datasetId: datasetId,
      documents: [documentId1, documentId2],
      chunkingStrategy: ChunkingStrategy.CHAPTER,
    });

    expect(result.jsonl).toBe(
      [
        JSON.stringify({
          document_id: documentId1,
          chunk_id: `${documentId1}-0`,
          text: 'First paragraph.',
        }),
        JSON.stringify({
          document_id: documentId1,
          chunk_id: `${documentId1}-1`,
          text: 'Second paragraph.',
        }),
        JSON.stringify({
          document_id: documentId2,
          chunk_id: `${documentId2}-0`,
          text: 'Only one paragraph',
        }),
      ].join('\n'),
    );
    expect(result.uncompleteDatasetFile).toBe('');
    expect(result.S3key).toBe('');
  });

  it('fetches, chunks, and generates JSONL with DOCUMENT strategy', async () => {
    const { useCase, documentConversionService } = setup();

    const datasetId = randomUUID();
    const documentId1 = randomUUID();
    const documentId2 = randomUUID();
    documentConversionService.seed({
      datasetId: datasetId,
      documentId: documentId1,
      text: 'First paragraph.\n\nSecond paragraph.',
    });
    documentConversionService.seed({
      datasetId: datasetId,
      documentId: documentId2,
      text: 'Only one paragraph',
    });

    const result = await useCase.execute({
      datasetId: datasetId,
      documents: [documentId1, documentId2],
      chunkingStrategy: ChunkingStrategy.DOCUMENT,
    });

    expect(result.jsonl).toBe(
      [
        JSON.stringify({
          document_id: documentId1,
          chunk_id: `${documentId1}-0`,
          text: 'First paragraph.\n\nSecond paragraph.',
        }),
        JSON.stringify({
          document_id: documentId2,
          chunk_id: `${documentId2}-0`,
          text: 'Only one paragraph',
        }),
      ].join('\n'),
    );
    expect(result.uncompleteDatasetFile).toBe('');
    expect(result.S3key).toBe('');
  });
  
});
