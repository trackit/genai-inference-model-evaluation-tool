import { describe, expect, it, vi } from 'vitest';
import { inject, reset } from '@trackit.io/di-container';
import {
  ChunkingStrategy,
  TaskType,
} from '../../models/DocumentConversion';
import { tokenFakeDocumentConversionService } from '../../services/DocumentConversionService/FakeDocumentConversionService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { randomUUID } from 'crypto';
import { tokenDocumentConversionUseCase } from './DocumentConversionUseCase';

const setup = () => {
  reset();
  registerTestInfrastructure();

  return {
    useCase: inject(tokenDocumentConversionUseCase),
    documentConversionService: inject(tokenFakeDocumentConversionService),
  };
};

describe('DocumentConversionUseCase execute', () => {
  it('fetches, chunks, and generates JSONL with CHAPTER strategy', async () => {
    const { useCase, documentConversionService } = setup();
    const fetchSpy = vi.spyOn(documentConversionService, 'fetchAndParse');

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

    const storeSpy = vi.spyOn(documentConversionService, 'storeConversionJsonl');

    const result = await useCase.execute({
      datasetId: datasetId,
      documents: [documentId1, documentId2],
      chunkingStrategy: ChunkingStrategy.CHAPTER,
      taskType: TaskType.SUMMARIZATION,
    });

    expect(result.S3key).toBe(`datasets/${datasetId}-converted.jsonl`);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith(datasetId, documentId1, 'pdf');
    expect(fetchSpy).toHaveBeenCalledWith(datasetId, documentId2, 'pdf');
    expect(storeSpy).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith(datasetId, expect.any(String));
    const storedJsonl = storeSpy.mock.calls[0][1] as string;
    const jsonObjects = storedJsonl
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
      {
        document_id: documentId1,
        chunk_id: `${documentId1}-0`,
        text: 'First paragraph.',
        summary: '',
      },
      {
        document_id: documentId1,
        chunk_id: `${documentId1}-1`,
        text: 'Second paragraph.',
        summary: '',
      },
      {
        document_id: documentId2,
        chunk_id: `${documentId2}-0`,
        text: 'Only one paragraph',
        summary: '',
      },
    ]);
  });

  it('fetches, chunks, and generates JSONL with DOCUMENT strategy', async () => {
    const { useCase, documentConversionService } = setup();
    const fetchSpy = vi.spyOn(documentConversionService, 'fetchAndParse');

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

    const storeSpy = vi.spyOn(documentConversionService, 'storeConversionJsonl');

    const result = await useCase.execute({
      datasetId: datasetId,
      documents: [documentId1, documentId2],
      chunkingStrategy: ChunkingStrategy.DOCUMENT,
      taskType: TaskType.CLASSIFICATION,
    });

    expect(result.S3key).toBe(`datasets/${datasetId}-converted.jsonl`);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith(datasetId, documentId1, 'pdf');
    expect(fetchSpy).toHaveBeenCalledWith(datasetId, documentId2, 'pdf');
    expect(storeSpy).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith(datasetId, expect.any(String));
    const storedJsonl = storeSpy.mock.calls[0][1] as string;
    const jsonObjects = storedJsonl
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
      {
        document_id: documentId1,
        chunk_id: `${documentId1}-0`,
        text: 'First paragraph.\n\nSecond paragraph.',
        label: '',
      },
      {
        document_id: documentId2,
        chunk_id: `${documentId2}-0`,
        text: 'Only one paragraph',
        label: '',
      },
    ]);
  });

  it('throws for invalid datasetId', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        datasetId: 'not-a-uuid',
        documents: [randomUUID()],
        chunkingStrategy: ChunkingStrategy.CHAPTER,
        taskType: TaskType.SUMMARIZATION,
      }),
    ).rejects.toThrow('datasetId must be a valid UUID');
  });

  it('throws for empty documents list', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        datasetId: randomUUID(),
        documents: [],
        chunkingStrategy: ChunkingStrategy.CHAPTER,
        taskType: TaskType.SUMMARIZATION,
      }),
    ).rejects.toThrow('documents must be a non-empty array of document UUIDs');
  });

  it('throws for invalid chunking strategy', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        datasetId: randomUUID(),
        documents: [randomUUID()],
        chunkingStrategy: 'INVALID' as ChunkingStrategy,
        taskType: TaskType.SUMMARIZATION,
      }),
    ).rejects.toThrow('chunkingStrategy must be one of');
  });

  it('chunks a document by chapter with multiple blank lines', async () => {
    const { useCase, documentConversionService } = setup();
    const datasetId = randomUUID();
    const documentId = randomUUID();

    documentConversionService.seed({
      datasetId,
      documentId,
      text: 'First paragraph.\n\n\nSecond paragraph.\n\nThird paragraph.',
    });

    const storeSpy = vi.spyOn(documentConversionService, 'storeConversionJsonl');

    await useCase.execute({
      datasetId,
      documents: [documentId],
      chunkingStrategy: ChunkingStrategy.CHAPTER,
      taskType: TaskType.SUMMARIZATION,
    });

    const storedJsonl = storeSpy.mock.calls[0][1] as string;
    const lines = storedJsonl.split('\n').filter(Boolean);
    const jsonObjects = lines.map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
      {
        document_id: documentId,
        chunk_id: `${documentId}-0`,
        text: 'First paragraph.',
        summary: '',
      },
      {
        document_id: documentId,
        chunk_id: `${documentId}-1`,
        text: 'Second paragraph.',
        summary: '',
      },
      {
        document_id: documentId,
        chunk_id: `${documentId}-2`,
        text: 'Third paragraph.',
        summary: '',
      },
    ]);
  });

  it('creates a single chunk for CHAPTER when no paragraph separators exist', async () => {
    const { useCase, documentConversionService } = setup();
    const datasetId = randomUUID();
    const documentId = randomUUID();

    documentConversionService.seed({
      datasetId,
      documentId,
      text: 'A single paragraph without blank lines.',
    });

    const storeSpy = vi.spyOn(documentConversionService, 'storeConversionJsonl');

    await useCase.execute({
      datasetId,
      documents: [documentId],
      chunkingStrategy: ChunkingStrategy.CHAPTER,
      taskType: TaskType.SUMMARIZATION,
    });

    const storedJsonl = storeSpy.mock.calls[0][1] as string;
    const lines = storedJsonl.split('\n').filter(Boolean);
    const jsonObjects = lines.map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
      {
        document_id: documentId,
        chunk_id: `${documentId}-0`,
        text: 'A single paragraph without blank lines.',
        summary: '',
      },
    ]);
  });

  it('trims extracted text for DOCUMENT strategy', async () => {
    const { useCase, documentConversionService } = setup();
    const datasetId = randomUUID();
    const documentId = randomUUID();

    documentConversionService.seed({
      datasetId,
      documentId,
      text: '\n\nOnly one paragraph with padding.\n\n',
    });

    const storeSpy = vi.spyOn(documentConversionService, 'storeConversionJsonl');

    await useCase.execute({
      datasetId,
      documents: [documentId],
      chunkingStrategy: ChunkingStrategy.DOCUMENT,
      taskType: TaskType.CLASSIFICATION,
    });

    const storedJsonl = storeSpy.mock.calls[0][1] as string;
    const jsonObjects = storedJsonl.split('\n').filter(Boolean).map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
      {
        document_id: documentId,
        chunk_id: `${documentId}-0`,
        text: 'Only one paragraph with padding.',
        label: '',
      },
    ]);
  });
});
