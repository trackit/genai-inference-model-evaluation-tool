import { inject, reset } from '@trackit.io/di-container';
import { randomUUID } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { ChunkingStrategy, TaskType } from '../../models/DocumentConversion';
import { JsonlParserImpl } from '../../parsers/JsonlParser/JsonlParser';
import { tokenFakeDocumentConversionService } from '../../services/DocumentConversionService/FakeDocumentConversionService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
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

    const dataset_id = randomUUID();
    const document_id1 = randomUUID();
    const document_id2 = randomUUID();
    documentConversionService.seed({
      dataset_id: dataset_id,
      document_id: document_id1,
      text: 'First paragraph.\n\nSecond paragraph.',
    });

    documentConversionService.seed({
      dataset_id: dataset_id,
      document_id: document_id2,
      text: 'Only one paragraph',
    });

    const storeSpy = vi.spyOn(
      documentConversionService,
      'storeConversionJsonl',
    );

    const result = await useCase.execute({
      dataset_id: dataset_id,
      documents: [
        { document_id: document_id1, file_type: 'pdf' },
        { document_id: document_id2, file_type: 'pdf' },
      ],
      chunking_strategy: ChunkingStrategy.CHAPTER,
      task_type: TaskType.SUMMARIZATION,
    });

    expect(result.converted_dataset_file_key).toBe(
      `datasets/${dataset_id}/${dataset_id}-converted.jsonl`,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith(dataset_id, document_id1, 'pdf');
    expect(fetchSpy).toHaveBeenCalledWith(dataset_id, document_id2, 'pdf');
    expect(storeSpy).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith(dataset_id, expect.any(String));
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
    const { useCase, documentConversionService } = setup();
    const fetchSpy = vi.spyOn(documentConversionService, 'fetchAndParse');

    const dataset_id = randomUUID();
    const document_id1 = randomUUID();
    const document_id2 = randomUUID();
    documentConversionService.seed({
      dataset_id: dataset_id,
      document_id: document_id1,
      text: 'First paragraph.\n\nSecond paragraph.',
    });
    documentConversionService.seed({
      dataset_id: dataset_id,
      document_id: document_id2,
      text: 'Only one paragraph',
    });

    const storeSpy = vi.spyOn(
      documentConversionService,
      'storeConversionJsonl',
    );

    const result = await useCase.execute({
      dataset_id: dataset_id,
      documents: [
        { document_id: document_id1, file_type: 'pdf' },
        { document_id: document_id2, file_type: 'pdf' },
      ],
      chunking_strategy: ChunkingStrategy.DOCUMENT,
      task_type: TaskType.CLASSIFICATION,
    });

    expect(result.converted_dataset_file_key).toBe(
      `datasets/${dataset_id}/${dataset_id}-converted.jsonl`,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith(dataset_id, document_id1, 'pdf');
    expect(fetchSpy).toHaveBeenCalledWith(dataset_id, document_id2, 'pdf');
    expect(storeSpy).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith(dataset_id, expect.any(String));
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

  it('throws for invalid dataset_id', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        dataset_id: 'not-a-uuid',
        documents: [
          { document_id: randomUUID(), file_type: 'pdf' },
          { document_id: randomUUID(), file_type: 'pdf' },
        ],
        chunking_strategy: ChunkingStrategy.CHAPTER,
        task_type: TaskType.SUMMARIZATION,
      }),
    ).rejects.toThrow('dataset_id must be a valid UUID');
  });

  it('throws for empty documents list', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        dataset_id: randomUUID(),
        documents: [],
        chunking_strategy: ChunkingStrategy.CHAPTER,
        task_type: TaskType.SUMMARIZATION,
      }),
    ).rejects.toThrow(
      'documents must be a non-empty array of document entries with document_id and file_type',
    );
  });

  it('throws for invalid chunking strategy', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        dataset_id: randomUUID(),
        documents: [
          { document_id: randomUUID(), file_type: 'pdf' },
          { document_id: randomUUID(), file_type: 'pdf' },
        ],
        chunking_strategy: 'INVALID' as ChunkingStrategy,
        task_type: TaskType.SUMMARIZATION,
      }),
    ).rejects.toThrow('chunking_strategy must be one of');
  });

  it('chunks a document by chapter headings when present', async () => {
    const { useCase, documentConversionService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    documentConversionService.seed({
      dataset_id,
      document_id,
      text: [
        'Chapter 1: Overview',
        'Overview content.',
        '',
        'Chapter 2: Details',
        'Detailed content.',
      ].join('\n'),
    });

    const storeSpy = vi.spyOn(
      documentConversionService,
      'storeConversionJsonl',
    );

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
    const { useCase, documentConversionService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    documentConversionService.seed({
      dataset_id,
      document_id,
      text: 'First paragraph.\n\n\nSecond paragraph.\n\nThird paragraph.',
    });

    const storeSpy = vi.spyOn(
      documentConversionService,
      'storeConversionJsonl',
    );

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
    const { useCase, documentConversionService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    documentConversionService.seed({
      dataset_id,
      document_id,
      text: 'A single paragraph without blank lines.',
    });

    const storeSpy = vi.spyOn(
      documentConversionService,
      'storeConversionJsonl',
    );

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
    const { useCase, documentConversionService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    documentConversionService.seed({
      dataset_id,
      document_id,
      text: '\n\nOnly one paragraph with padding.\n\n',
    });

    const storeSpy = vi.spyOn(
      documentConversionService,
      'storeConversionJsonl',
    );

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
    const { useCase, documentConversionService } = setup();
    const fetchSpy = vi.spyOn(documentConversionService, 'fetchAndParse');

    const dataset_id = randomUUID();
    const document_id = randomUUID();

    documentConversionService.seed({
      dataset_id,
      document_id,
      text: 'Docx body content',
    });

    const storeSpy = vi.spyOn(
      documentConversionService,
      'storeConversionJsonl',
    );

    await useCase.execute({
      dataset_id,
      documents: [{ document_id, file_type: 'docx' }],
      chunking_strategy: ChunkingStrategy.DOCUMENT,
      task_type: TaskType.SUMMARIZATION,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(dataset_id, document_id, 'docx');

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

  it('throws for unsupported file types instead of skipping them', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        dataset_id: randomUUID(),
        documents: [{ document_id: randomUUID(), file_type: 'csv' }],
        chunking_strategy: ChunkingStrategy.DOCUMENT,
        task_type: TaskType.SUMMARIZATION,
      }),
    ).rejects.toThrow('file_type must be one of: pdf, doc, docx');
  });

  it('throws when extracted text is empty', async () => {
    const { useCase, documentConversionService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    documentConversionService.seed({
      dataset_id,
      document_id,
      text: '   \n\n   ',
    });

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
