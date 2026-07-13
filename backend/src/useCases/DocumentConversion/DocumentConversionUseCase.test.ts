import { inject, reset } from '@trackit.io/di-container';
import { randomUUID } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { ChunkingStrategy, TaskType } from '../../models/DocumentConversion';
import { JsonlParserImpl } from '../../parsers/JsonlParser/JsonlParser';
import { tokenFakeDatasetService } from '../../services/DatasetService/FakeDatasetService';
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

    const storeSpy = vi.spyOn(datasetService, 'storeConversionJsonl');

    const result = await useCase.execute({
      dataset_id: dataset_id,
      documents: [
        { document_id: document_id1, file_type: 'pdf' },
        { document_id: document_id2, file_type: 'pdf' },
      ],
      chunking_strategy: ChunkingStrategy.CHAPTER,
      task_type: TaskType.SUMMARIZATION,
    });

    expect(result).toBe(`datasets/${dataset_id}/${dataset_id}-converted.jsonl`);
    expect(parseSpy).toHaveBeenCalledTimes(2);
    expect(parseSpy).toHaveBeenCalledWith(buffer1, 'pdf');
    expect(parseSpy).toHaveBeenCalledWith(buffer2, 'pdf');
    expect(storeSpy).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith(
      `datasets/${dataset_id}/${dataset_id}-converted.jsonl`,
      expect.any(String),
    );
    const storedJsonl = storeSpy.mock.calls[0][1] as string;
    const jsonObjects = storedJsonl
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
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

    expect(new JsonlParserImpl().parse(storedJsonl).samples).toEqual([
      { document: 'First paragraph.' },
      { document: 'Second paragraph.' },
      { document: 'Only one paragraph' },
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

    const storeSpy = vi.spyOn(datasetService, 'storeConversionJsonl');

    const result = await useCase.execute({
      dataset_id: dataset_id,
      documents: [
        { document_id: document_id1, file_type: 'pdf' },
        { document_id: document_id2, file_type: 'pdf' },
      ],
      chunking_strategy: ChunkingStrategy.DOCUMENT,
      task_type: TaskType.CLASSIFICATION,
    });

    expect(result).toBe(`datasets/${dataset_id}/${dataset_id}-converted.jsonl`);
    expect(parseSpy).toHaveBeenCalledTimes(2);
    expect(parseSpy).toHaveBeenCalledWith(buffer1, 'pdf');
    expect(parseSpy).toHaveBeenCalledWith(buffer2, 'pdf');
    expect(storeSpy).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith(
      `datasets/${dataset_id}/${dataset_id}-converted.jsonl`,
      expect.any(String),
    );
    const storedJsonl = storeSpy.mock.calls[0][1] as string;
    const jsonObjects = storedJsonl
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
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

  it('chunks a document by chapter headings when present', async () => {
    const { useCase, datasetService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    datasetService.seedRawContent(
      dataset_id,
      document_id,
      'pdf',
      Buffer.from(
        'Chapter 1: Overview\nOverview content.\n\nChapter 2: Details\nDetailed content.',
      ),
    );

    const storeSpy = vi.spyOn(datasetService, 'storeConversionJsonl');

    await useCase.execute({
      dataset_id,
      documents: [{ document_id, file_type: 'pdf' }],
      chunking_strategy: ChunkingStrategy.CHAPTER,
      task_type: TaskType.SUMMARIZATION,
    });

    const storedJsonl = storeSpy.mock.calls[0][1] as string;
    const jsonObjects = storedJsonl
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
      {
        document_id: document_id,
        chunk_id: `${document_id}-0`,
        document: 'Chapter 1: Overview\nOverview content.',
        summary: '',
      },
      {
        document_id: document_id,
        chunk_id: `${document_id}-1`,
        document: 'Chapter 2: Details\nDetailed content.',
        summary: '',
      },
    ]);
  });

  it('chunks a document by chapter with multiple blank lines', async () => {
    const { useCase, datasetService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    datasetService.seedRawContent(
      dataset_id,
      document_id,
      'pdf',
      Buffer.from(
        'First paragraph.\n\n\nSecond paragraph.\n\nThird paragraph.',
      ),
    );

    const storeSpy = vi.spyOn(datasetService, 'storeConversionJsonl');

    await useCase.execute({
      dataset_id,
      documents: [{ document_id, file_type: 'pdf' }],
      chunking_strategy: ChunkingStrategy.CHAPTER,
      task_type: TaskType.SUMMARIZATION,
    });

    const storedJsonl = storeSpy.mock.calls[0][1] as string;
    const lines = storedJsonl.split('\n').filter(Boolean);
    const jsonObjects = lines.map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
      {
        document_id: document_id,
        chunk_id: `${document_id}-0`,
        document: 'First paragraph.',
        summary: '',
      },
      {
        document_id: document_id,
        chunk_id: `${document_id}-1`,
        document: 'Second paragraph.',
        summary: '',
      },
      {
        document_id: document_id,
        chunk_id: `${document_id}-2`,
        document: 'Third paragraph.',
        summary: '',
      },
    ]);
  });

  it('creates a single chunk for CHAPTER when no paragraph separators exist', async () => {
    const { useCase, datasetService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    datasetService.seedRawContent(
      dataset_id,
      document_id,
      'pdf',
      Buffer.from('A single paragraph without blank lines.'),
    );

    const storeSpy = vi.spyOn(datasetService, 'storeConversionJsonl');

    await useCase.execute({
      dataset_id,
      documents: [{ document_id, file_type: 'pdf' }],
      chunking_strategy: ChunkingStrategy.CHAPTER,
      task_type: TaskType.SUMMARIZATION,
    });

    const storedJsonl = storeSpy.mock.calls[0][1] as string;
    const lines = storedJsonl.split('\n').filter(Boolean);
    const jsonObjects = lines.map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
      {
        document_id: document_id,
        chunk_id: `${document_id}-0`,
        document: 'A single paragraph without blank lines.',
        summary: '',
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

    const storeSpy = vi.spyOn(datasetService, 'storeConversionJsonl');

    await useCase.execute({
      dataset_id,
      documents: [{ document_id, file_type: 'pdf' }],
      chunking_strategy: ChunkingStrategy.DOCUMENT,
      task_type: TaskType.CLASSIFICATION,
    });

    const storedJsonl = storeSpy.mock.calls[0][1] as string;
    const jsonObjects = storedJsonl
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
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

    const storeSpy = vi.spyOn(datasetService, 'storeConversionJsonl');

    await useCase.execute({
      dataset_id,
      documents: [{ document_id, file_type: 'docx' }],
      chunking_strategy: ChunkingStrategy.DOCUMENT,
      task_type: TaskType.SUMMARIZATION,
    });

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(parseSpy).toHaveBeenCalledWith(buffer, 'docx');

    const storedJsonl = storeSpy.mock.calls[0][1] as string;
    const jsonObjects = storedJsonl
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
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
});
