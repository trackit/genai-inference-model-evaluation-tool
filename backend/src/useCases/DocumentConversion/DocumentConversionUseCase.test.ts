import { inject, reset } from '@trackit.io/di-container';
import { randomUUID } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { DatasetFileType } from '../../models/Dataset';
import { ChunkingStrategy } from '../../models/DocumentConversion';
import { documentS3Key } from '../../services/DatasetService/DatasetServiceS3';
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

/** Seeds the upload manifest the use case reads to resolve which docs to convert. */
const seedManifest = (
  datasetService: FakeDatasetService,
  datasetId: string,
  documents: { document_id: string; file_type: DatasetFileType }[],
): Promise<void> =>
  datasetService.writeUploadManifest(datasetId, {
    max_total_bytes: 209_715_200,
    files: documents.map((doc, index) => ({
      document_id: doc.document_id,
      filename: `doc-${index}.${doc.file_type}`,
      file_type: doc.file_type,
      s3_key: documentS3Key(datasetId, doc.document_id, doc.file_type),
      size_bytes: 100,
    })),
  });

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
    await seedManifest(datasetService, dataset_id, [
      { document_id: document_id1, file_type: 'pdf' },
      { document_id: document_id2, file_type: 'pdf' },
    ]);

    const result = await useCase.execute({
      dataset_id: dataset_id,
      chunking_strategy: ChunkingStrategy.SECTION,
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
      },
      {
        document_id: document_id1,
        chunk_id: `${document_id1}-1`,
        document: 'Second paragraph.',
      },
      {
        document_id: document_id2,
        chunk_id: `${document_id2}-0`,
        document: 'Only one paragraph',
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
    await seedManifest(datasetService, dataset_id, [
      { document_id: document_id1, file_type: 'pdf' },
      { document_id: document_id2, file_type: 'pdf' },
    ]);

    const result = await useCase.execute({
      dataset_id: dataset_id,
      chunking_strategy: ChunkingStrategy.DOCUMENT,
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
      },
      {
        document_id: document_id2,
        chunk_id: `${document_id2}-0`,
        document: 'Only one paragraph',
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
    await seedManifest(datasetService, dataset_id, [
      { document_id, file_type: 'pdf' },
    ]);

    await useCase.execute({
      dataset_id,
      chunking_strategy: ChunkingStrategy.DOCUMENT,
    });

    expect(parseJsonlLines(getStoredJsonl(datasetService))).toEqual([
      {
        document_id: document_id,
        chunk_id: `${document_id}-0`,
        document: 'Only one paragraph with padding.',
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
    await seedManifest(datasetService, dataset_id, [
      { document_id, file_type: 'docx' },
    ]);

    await useCase.execute({
      dataset_id,
      chunking_strategy: ChunkingStrategy.DOCUMENT,
    });

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(parseSpy).toHaveBeenCalledWith(buffer, 'docx');

    expect(parseJsonlLines(getStoredJsonl(datasetService))).toEqual([
      {
        document_id: document_id,
        chunk_id: `${document_id}-0`,
        document: 'Docx body content',
      },
    ]);
  });

  it('throws when the upload manifest is missing', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        dataset_id: randomUUID(),
        chunking_strategy: ChunkingStrategy.DOCUMENT,
      }),
    ).rejects.toThrow(/manifest/i);
  });

  it('throws when no pdf/doc/docx documents are present', async () => {
    const { useCase, datasetService } = setup();
    const dataset_id = randomUUID();
    await datasetService.writeUploadManifest(dataset_id, {
      max_total_bytes: 209_715_200,
      files: [],
    });

    await expect(
      useCase.execute({
        dataset_id,
        chunking_strategy: ChunkingStrategy.DOCUMENT,
      }),
    ).rejects.toThrow(/no pdf\/doc\/docx documents/i);
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
    await seedManifest(datasetService, dataset_id, [
      { document_id, file_type: 'pdf' },
    ]);

    await expect(
      useCase.execute({
        dataset_id,
        chunking_strategy: ChunkingStrategy.DOCUMENT,
      }),
    ).rejects.toThrow(
      `Document "${document_id}" could not be converted into readable text`,
    );
  });

  it('propagates a not-found error when raw content is missing for a document', async () => {
    const { useCase, datasetService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    await seedManifest(datasetService, dataset_id, [
      { document_id, file_type: 'pdf' },
    ]);

    // Manifest present but raw content intentionally not seeded — fetchRawContent
    // should reject, and that must surface out of execute().
    await expect(
      useCase.execute({
        dataset_id,
        chunking_strategy: ChunkingStrategy.DOCUMENT,
      }),
    ).rejects.toThrow('Raw content not found');
  });

  it('fetches, chunks, and generates JSONL with CUSTOM strategy using plain string delimiter', async () => {
    const { useCase, datasetService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    datasetService.seedRawContent(
      dataset_id,
      document_id,
      'pdf',
      Buffer.from('Part A##Part B##Part C'),
    );
    await seedManifest(datasetService, dataset_id, [
      { document_id, file_type: 'pdf' },
    ]);

    await useCase.execute({
      dataset_id,
      chunking_strategy: ChunkingStrategy.CUSTOM,
      custom_delimiter: '##',
    });

    expect(parseJsonlLines(getStoredJsonl(datasetService))).toEqual([
      {
        document_id: document_id,
        chunk_id: `${document_id}-0`,
        document: 'Part A',
      },
      {
        document_id: document_id,
        chunk_id: `${document_id}-1`,
        document: 'Part B',
      },
      {
        document_id: document_id,
        chunk_id: `${document_id}-2`,
        document: 'Part C',
      },
    ]);
  });

  it('chunks with CUSTOM strategy using regex delimiter', async () => {
    const { useCase, datasetService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    datasetService.seedRawContent(
      dataset_id,
      document_id,
      'pdf',
      Buffer.from('Chapter 1\nContent\nChapter 2\nMore content'),
    );
    await seedManifest(datasetService, dataset_id, [
      { document_id, file_type: 'pdf' },
    ]);

    await useCase.execute({
      dataset_id,
      chunking_strategy: ChunkingStrategy.CUSTOM,
      custom_delimiter: 'Chapter ',
    });

    const lines = parseJsonlLines(getStoredJsonl(datasetService));
    expect(lines.length).toBe(2);
  });

  it('returns single chunk when CUSTOM delimiter not found', async () => {
    const { useCase, datasetService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    datasetService.seedRawContent(
      dataset_id,
      document_id,
      'pdf',
      Buffer.from('A document without the delimiter'),
    );
    await seedManifest(datasetService, dataset_id, [
      { document_id, file_type: 'pdf' },
    ]);

    await useCase.execute({
      dataset_id,
      chunking_strategy: ChunkingStrategy.CUSTOM,
      custom_delimiter: '##',
    });

    expect(parseJsonlLines(getStoredJsonl(datasetService))).toEqual([
      {
        document_id: document_id,
        chunk_id: `${document_id}-0`,
        document: 'A document without the delimiter',
      },
    ]);
  });

  it('throws when CUSTOM strategy selected without delimiter', async () => {
    const { useCase, datasetService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    datasetService.seedRawContent(
      dataset_id,
      document_id,
      'pdf',
      Buffer.from('Some content'),
    );
    await seedManifest(datasetService, dataset_id, [
      { document_id, file_type: 'pdf' },
    ]);

    await expect(
      useCase.execute({
        dataset_id,
        chunking_strategy: ChunkingStrategy.CUSTOM,
      }),
    ).rejects.toThrow('Custom delimiter is required');
  });

  it('throws when CUSTOM delimiter exceeds max length', async () => {
    const { useCase, datasetService } = setup();
    const dataset_id = randomUUID();
    const document_id = randomUUID();

    datasetService.seedRawContent(
      dataset_id,
      document_id,
      'pdf',
      Buffer.from('Some content'),
    );
    await seedManifest(datasetService, dataset_id, [
      { document_id, file_type: 'pdf' },
    ]);

    await expect(
      useCase.execute({
        dataset_id,
        chunking_strategy: ChunkingStrategy.CUSTOM,
        custom_delimiter: 'a'.repeat(51),
      }),
    ).rejects.toThrow('Custom delimiter must be between 1 and 50 characters');
  });
});
