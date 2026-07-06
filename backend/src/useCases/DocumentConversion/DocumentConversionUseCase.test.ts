import { describe, expect, it, vi } from 'vitest';
import { inject, reset } from '@trackit.io/di-container';
import { ChunkingStrategy } from '../../models/DocumentConversion';
import { tokenFakeDocumentConversionService } from '../../services/DocumentConversionService/FakeDocumentConversionService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { mockClient } from 'aws-sdk-client-mock';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { tokenClientS3 } from '../../services/DatasetService/DatasetServiceS3';
import { randomUUID } from 'crypto';
import { tokenDocumentConversionUseCase } from './DocumentConversionUseCase';

const setup = () => {
  reset();
  registerTestInfrastructure();
  
  process.env.DATASET_BUCKET = 'test-bucket';

  const s3Mock = mockClient(inject(tokenClientS3));
  s3Mock.on(PutObjectCommand).resolves({});

  return {
    useCase: inject(tokenDocumentConversionUseCase),
    documentConversionService: inject(tokenFakeDocumentConversionService),
    s3Mock,
  };
};

describe('DocumentConversionUseCase execute', () => {
  it('fetches, chunks, and generates JSONL with CHAPTER strategy', async () => {
    const { useCase, documentConversionService, s3Mock } = setup();
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

    const result = await useCase.execute({
      datasetId: datasetId,
      documents: [documentId1, documentId2],
      chunkingStrategy: ChunkingStrategy.CHAPTER,
    });

    expect(result.S3key).toBe(`datasets/${datasetId}-converted.jsonl`);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith(datasetId, documentId1, 'pdf');
    expect(fetchSpy).toHaveBeenCalledWith(datasetId, documentId2, 'pdf');

    const putCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].args[0].input).toMatchObject({
      Bucket: 'test-bucket',
      Key: `datasets/${datasetId}-converted.jsonl`,
      ContentType: 'application/jsonl',
      ServerSideEncryption: 'AES256',
    });

    const bodyText = String(putCalls[0].args[0].input.Body);
    const lines = bodyText.split('\n').filter(Boolean);
    const jsonObjects = lines.map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
      {
        document_id: documentId1,
        chunk_id: `${documentId1}-0`,
        text: 'First paragraph.',
      },
      {
        document_id: documentId1,
        chunk_id: `${documentId1}-1`,
        text: 'Second paragraph.',
      },
      {
        document_id: documentId2,
        chunk_id: `${documentId2}-0`,
        text: 'Only one paragraph',
      },
    ]);
  });

  it('fetches, chunks, and generates JSONL with DOCUMENT strategy', async () => {
    const { useCase, documentConversionService, s3Mock } = setup();
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

    const result = await useCase.execute({
      datasetId: datasetId,
      documents: [documentId1, documentId2],
      chunkingStrategy: ChunkingStrategy.DOCUMENT,
    });

    expect(result.S3key).toBe(`datasets/${datasetId}-converted.jsonl`);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith(datasetId, documentId1, 'pdf');
    expect(fetchSpy).toHaveBeenCalledWith(datasetId, documentId2, 'pdf');

    const putCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].args[0].input).toMatchObject({
      Bucket: 'test-bucket',
      Key: `datasets/${datasetId}-converted.jsonl`,
      ContentType: 'application/jsonl',
      ServerSideEncryption: 'AES256',
    });

    const bodyText = String(putCalls[0].args[0].input.Body);
    const lines = bodyText.split('\n').filter(Boolean);
    const jsonObjects = lines.map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
      {
        document_id: documentId1,
        chunk_id: `${documentId1}-0`,
        text: 'First paragraph.\n\nSecond paragraph.',
      },
      {
        document_id: documentId2,
        chunk_id: `${documentId2}-0`,
        text: 'Only one paragraph',
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
      }),
    ).rejects.toThrow('chunkingStrategy must be one of');
  });

  it('chunks a document by chapter with multiple blank lines', async () => {
    const { useCase, documentConversionService, s3Mock } = setup();
    const datasetId = randomUUID();
    const documentId = randomUUID();

    documentConversionService.seed({
      datasetId,
      documentId,
      text: 'First paragraph.\n\n\nSecond paragraph.\n\nThird paragraph.',
    });

    await useCase.execute({
      datasetId,
      documents: [documentId],
      chunkingStrategy: ChunkingStrategy.CHAPTER,
    });

    const bodyText = String(s3Mock.commandCalls(PutObjectCommand)[0].args[0].input.Body);
    const lines = bodyText.split('\n').filter(Boolean);
    const jsonObjects = lines.map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
      {
        document_id: documentId,
        chunk_id: `${documentId}-0`,
        text: 'First paragraph.',
      },
      {
        document_id: documentId,
        chunk_id: `${documentId}-1`,
        text: 'Second paragraph.',
      },
      {
        document_id: documentId,
        chunk_id: `${documentId}-2`,
        text: 'Third paragraph.',
      },
    ]);
  });

  it('creates a single chunk for CHAPTER when no paragraph separators exist', async () => {
    const { useCase, documentConversionService, s3Mock } = setup();
    const datasetId = randomUUID();
    const documentId = randomUUID();

    documentConversionService.seed({
      datasetId,
      documentId,
      text: 'A single paragraph without blank lines.',
    });

    await useCase.execute({
      datasetId,
      documents: [documentId],
      chunkingStrategy: ChunkingStrategy.CHAPTER,
    });

    const bodyText = String(s3Mock.commandCalls(PutObjectCommand)[0].args[0].input.Body);
    const lines = bodyText.split('\n').filter(Boolean);
    const jsonObjects = lines.map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
      {
        document_id: documentId,
        chunk_id: `${documentId}-0`,
        text: 'A single paragraph without blank lines.',
      },
    ]);
  });

  it('trims extracted text for DOCUMENT strategy', async () => {
    const { useCase, documentConversionService, s3Mock } = setup();
    const datasetId = randomUUID();
    const documentId = randomUUID();

    documentConversionService.seed({
      datasetId,
      documentId,
      text: '\n\nOnly one paragraph with padding.\n\n',
    });

    await useCase.execute({
      datasetId,
      documents: [documentId],
      chunkingStrategy: ChunkingStrategy.DOCUMENT,
    });

    const bodyText = String(s3Mock.commandCalls(PutObjectCommand)[0].args[0].input.Body);
    const jsonObjects = bodyText.split('\n').filter(Boolean).map((line) => JSON.parse(line));

    expect(jsonObjects).toEqual([
      {
        document_id: documentId,
        chunk_id: `${documentId}-0`,
        text: 'Only one paragraph with padding.',
      },
    ]);
  });
});
