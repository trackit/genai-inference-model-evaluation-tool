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
    expect(String(putCalls[0].args[0].input.Body)).toContain('First paragraph.');
    expect(String(putCalls[0].args[0].input.Body)).toContain('Second paragraph.');
    expect(String(putCalls[0].args[0].input.Body)).toContain('Only one paragraph');
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
  
});
