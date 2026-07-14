import { inject, reset } from '@trackit.io/di-container';
import { randomUUID } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { ChunkingStrategy, TaskType } from '../../models/DocumentConversion';
import {
  FakeDatasetService,
  tokenFakeDatasetService,
} from '../../services/DatasetService/FakeDatasetService';
import { tokenFakeDocumentConversionService } from '../../services/DocumentConversionService/FakeDocumentConversionService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { tokenDocumentConversionUseCase } from './DocumentConversionUseCase';

const setup = () => {
  reset();
  registerTestInfrastructure();

  return {
    useCase: inject(tokenDocumentConversionUseCase),
    documentConversionService: inject(tokenFakeDocumentConversionService),
    datasetService: inject(tokenFakeDatasetService),
  };
};

/** JSONL string from the most recent storeConversionJsonl call recorded on the fake. */
const getStoredJsonl = (datasetService: FakeDatasetService): string =>
  datasetService.convertedDatasets[0].jsonl;

/** Parses a JSONL string into an array of objects, one per non-empty line. */
const parseJsonlLines = (jsonl: string): Record<string, unknown>[] =>
  jsonl
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

describe('DocumentConversionUseCase execute', () => {
  it('fetches, chunks, and generates JSONL with CHAPTER strategy', async () => {
    const { useCase, documentConversionService, datasetService } = setup();
    const parseSpy = vi.spyOn(documentConversionService, 'parse');
    const dataset_id = randomUUID();
    const document_id1 = randomUUID();
    const document_id2 = randomUUID();

    const buffer1 = Buffer.from('First paragraph.\n\nSecond paragraph.');
    const buffer2 = Buffer.from('Only one paragraph');
    datasetService.seedRawContent(dataset_id, document_id1, 'pdf', buffer1);
    datasetService.seedRawContent(dataset_id, document_id2, 'pdf', buffer2);

    const result = await useCase.execute({
      dataset_id: dataset_id,
      documents: [
        { document_id: document_id1, file_type: 'pdf' },
        { document_id: document_id2, file_type: 'pdf' },
      ],
      chunking_strategy: ChunkingStrategy.CHAPTER,
      task_type: TaskType.SUMMARIZATION,
    });

    expect(parseSpy).toHaveBeenCalledTimes(datasetService.rawContents.length);
    expect(parseSpy).toHaveBeenCalledWith(buffer1, 'pdf');
    expect(parseSpy).toHaveBeenCalledWith(buffer2, 'pdf');
    expect(datasetService.convertedDatasets).toHaveLength(1);
    expect(result).toBe(datasetService.convertedDatasets[0].key);

    expect(parseJsonlLines(getStoredJsonl(datasetService))).toEqual([
      {
        document_id: document_id1,
        chunk_id: `${document_id1}-0`,
        document: 'First paragraph.',
        summary: '',
      },
      {
        document_id: document_id1,
        chunk_id: `${document_id1}-1`,
        document: 'Second paragraph.',
        summary: '',
      },
      {
        document_id: document_id2,
        chunk_id: `${document_id2}-0`,
        document: 'Only one paragraph',
        summary: '',
      },
    ]);
  });

  it('fetches, chunks, and generates JSONL with DOCUMENT strategy', async () => {
    const { useCase, documentConversionService, datasetService } = setup();
    const parseSpy = vi.spyOn(documentConversionService, 'parse');

    const dataset_id = randomUUID();
    const document_id1 = randomUUID();
    const document_id2 = randomUUID();
    const buffer1 = Buffer.from('First paragraph.\n\nSecond paragraph.');
    const buffer2 = Buffer.from('Only one paragraph');
    datasetService.seedRawContent(dataset_id, document_id1, 'pdf', buffer1);
    datasetService.seedRawContent(dataset_id, document_id2, 'pdf', buffer2);

    const result = await useCase.execute({
      dataset_id: dataset_id,
      documents: [
        { document_id: document_id1, file_type: 'pdf' },
        { document_id: document_id2, file_type: 'pdf' },
      ],
      chunking_strategy: ChunkingStrategy.DOCUMENT,
      task_type: TaskType.CLASSIFICATION,
    });

    expect(parseSpy).toHaveBeenCalledTimes(2);
    expect(parseSpy).toHaveBeenCalledWith(buffer1, 'pdf');
    expect(parseSpy).toHaveBeenCalledWith(buffer2, 'pdf');
    expect(datasetService.convertedDatasets).toHaveLength(1);
    expect(result).toBe(datasetService.convertedDatasets[0].key);

    expect(parseJsonlLines(getStoredJsonl(datasetService))).toEqual([
      {
        document_id: document_id1,
        chunk_id: `${document_id1}-0`,
        document: 'First paragraph.\n\nSecond paragraph.',
        class: '',
      },
      {
        document_id: document_id2,
        chunk_id: `${document_id2}-0`,
        document: 'Only one paragraph',
        class: '',
      },
    ]);
  });

  it('trims extracted text for DOCUMENT strategy', async () => {
    const { useCase, datasetService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    datasetService.seedRawContent(
      dataset_id,
      document_id,
      'pdf',
      Buffer.from('\n\nOnly one paragraph with padding.\n\n'),
    );

    await useCase.execute({
      dataset_id,
      documents: [{ document_id, file_type: 'pdf' }],
      chunking_strategy: ChunkingStrategy.DOCUMENT,
      task_type: TaskType.CLASSIFICATION,
    });

    expect(parseJsonlLines(getStoredJsonl(datasetService))).toEqual([
      {
        document_id: document_id,
        chunk_id: `${document_id}-0`,
        document: 'Only one paragraph with padding.',
        class: '',
      },
    ]);
  });

  it('parses docx documents end-to-end', async () => {
    const { useCase, documentConversionService, datasetService } = setup();
    const parseSpy = vi.spyOn(documentConversionService, 'parse');

    const dataset_id = randomUUID();
    const document_id = randomUUID();
    const buffer = Buffer.from('Docx body content');
    datasetService.seedRawContent(dataset_id, document_id, 'docx', buffer);

    await useCase.execute({
      dataset_id,
      documents: [{ document_id, file_type: 'docx' }],
      chunking_strategy: ChunkingStrategy.DOCUMENT,
      task_type: TaskType.SUMMARIZATION,
    });

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(parseSpy).toHaveBeenCalledWith(buffer, 'docx');

    expect(parseJsonlLines(getStoredJsonl(datasetService))).toEqual([
      {
        document_id: document_id,
        chunk_id: `${document_id}-0`,
        document: 'Docx body content',
        summary: '',
      },
    ]);
  });

  it('throws when extracted text is empty', async () => {
    const { useCase, datasetService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    datasetService.seedRawContent(
      dataset_id,
      document_id,
      'pdf',
      Buffer.from('   \n\n   '),
    );

    await expect(
      useCase.execute({
        dataset_id,
        documents: [{ document_id, file_type: 'pdf' }],
        chunking_strategy: ChunkingStrategy.DOCUMENT,
        task_type: TaskType.SUMMARIZATION,
      }),
    ).rejects.toThrow(
      `Document "${document_id}" could not be converted into readable text`,
    );
  });

  it('propagates a not-found error when raw content is missing for a document', async () => {
    const { useCase } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    // Intentionally not seeded — fetchRawContent should reject, and that
    // rejection must surface out of execute() rather than being swallowed
    // inside the Promise.all in fetchAndParseAll.
    await expect(
      useCase.execute({
        dataset_id,
        documents: [{ document_id, file_type: 'pdf' }],
        chunking_strategy: ChunkingStrategy.DOCUMENT,
        task_type: TaskType.SUMMARIZATION,
      }),
    ).rejects.toThrow('Raw content not found');
  });
});
