import {
  GetObjectCommand,
  GetObjectCommandOutput,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { inject, reset } from '@trackit.io/di-container';
import { mockClient } from 'aws-sdk-client-mock';
import { readFileSync } from 'node:fs';
import { Readable } from 'stream';
import { describe, expect, it } from 'vitest';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { tokenClientS3 } from '../DatasetService/DatasetServiceS3';
import { DocumentConversionServiceImpl } from './DocumentConversionServiceS3';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockS3Body(content: Buffer): GetObjectCommandOutput['Body'] {
  const readable = new Readable({
    read() {
      this.push(content);
      this.push(null);
    },
  });

  return Object.assign(readable, {
    transformToByteArray: async () => new Uint8Array(content),
    transformToString: async () => content.toString('utf-8'),
  }) as unknown as GetObjectCommandOutput['Body'];
}

/** Builds a minimal valid single-page PDF binary containing the given text */
function buildMinimalPdf(text: string): Buffer {
  const escaped = text.replace(/[()\\]/g, (c) => `\\${c}`);
  const stream = `BT /F1 12 Tf 100 700 Td (${escaped}) Tj ET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj`,
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj + '\n';
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) body += String(o).padStart(10, '0') + ' 00000 n \n';
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

const DATASET_ID = 'a1b2c3d4-0000-0000-0000-000000000001';
const DOCUMENT_ID = 'e5f6a7b8-0000-0000-0000-000000000002';

const setup = () => {
  reset();
  registerTestInfrastructure();
  process.env.DATASET_BUCKET = 'test-bucket';
  const s3Mock = mockClient(inject(tokenClientS3));
  return { service: new DocumentConversionServiceImpl(), s3Mock };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocumentConversionServiceS3', () => {
  describe('fetchAndParse', () => {
    describe('S3 fetching', () => {
      it('calls GetObject with the correct key and bucket', async () => {
        const { service, s3Mock } = setup();
        s3Mock.on(GetObjectCommand).resolves({
          Body: mockS3Body(buildMinimalPdf('test')),
        });

        await service.fetchAndParse(DATASET_ID, DOCUMENT_ID, 'pdf');

        const calls = s3Mock.commandCalls(GetObjectCommand);
        expect(calls).toHaveLength(1);
        expect(calls[0].args[0].input).toMatchObject({
          Bucket: 'test-bucket',
          Key: `documents/${DATASET_ID}/${DOCUMENT_ID}.pdf`,
        });
      });

      it.each([['pdf'], ['doc'], ['docx']] as const)(
        'builds the correct S3 key for fileType=%s',
        async (fileType) => {
          const { service, s3Mock } = setup();
          s3Mock.on(GetObjectCommand).resolves({
            Body: mockS3Body(buildMinimalPdf('test')),
          });

          await service
            .fetchAndParse(DATASET_ID, DOCUMENT_ID, fileType)
            .catch(() => {
              // doc/docx will fail to parse a PDF buffer — that's expected here
            });

          const key =
            s3Mock.commandCalls(GetObjectCommand)[0].args[0].input.Key;
          expect(key).toBe(
            `documents/${DATASET_ID}/${DOCUMENT_ID}.${fileType}`,
          );
        },
      );

      it('propagates S3 errors', async () => {
        const { service, s3Mock } = setup();
        s3Mock
          .on(GetObjectCommand)
          .rejects(
            Object.assign(new Error('Access Denied'), { name: 'AccessDenied' }),
          );

        await expect(
          service.fetchAndParse(DATASET_ID, DOCUMENT_ID, 'pdf'),
        ).rejects.toThrow('Access Denied');
      });

      it('propagates NoSuchKey without masking it', async () => {
        const { service, s3Mock } = setup();
        s3Mock.on(GetObjectCommand).rejects(
          Object.assign(new Error('The specified key does not exist.'), {
            name: 'NoSuchKey',
          }),
        );

        await expect(
          service.fetchAndParse(DATASET_ID, DOCUMENT_ID, 'pdf'),
        ).rejects.toThrow('The specified key does not exist.');
      });
    });

    describe('PDF parsing', () => {
      it('extracts text from a valid PDF', async () => {
        const { service, s3Mock } = setup();
        s3Mock.on(GetObjectCommand).resolves({
          Body: mockS3Body(buildMinimalPdf('Hello PDF')),
        });

        const result = await service.fetchAndParse(
          DATASET_ID,
          DOCUMENT_ID,
          'pdf',
        );

        expect(result.document_id).toBe(DOCUMENT_ID);
        expect(result.text).toContain('Hello PDF');
      });

      it('trims whitespace from extracted text', async () => {
        const { service, s3Mock } = setup();
        s3Mock.on(GetObjectCommand).resolves({
          Body: mockS3Body(buildMinimalPdf('trimmed')),
        });

        const result = await service.fetchAndParse(
          DATASET_ID,
          DOCUMENT_ID,
          'pdf',
        );

        expect(result.text).toBe(result.text.trim());
      });

      it('throws on a corrupt PDF buffer', async () => {
        const { service, s3Mock } = setup();
        s3Mock.on(GetObjectCommand).resolves({
          Body: mockS3Body(Buffer.from('not a pdf')),
        });

        await expect(
          service.fetchAndParse(DATASET_ID, DOCUMENT_ID, 'pdf'),
        ).rejects.toThrow();
      });
    });

    describe('DOCX parsing', () => {
      it('extracts text from a valid docx via Mammoth', async () => {
        const { service, s3Mock } = setup();
        const docxBuffer = readFileSync(
          new URL('../../test/fixtures/sample.docx', import.meta.url),
        );
        s3Mock.on(GetObjectCommand).resolves({
          Body: mockS3Body(docxBuffer),
        });

        const result = await service.fetchAndParse(
          DATASET_ID,
          DOCUMENT_ID,
          'docx',
        );

        expect(result.document_id).toBe(DOCUMENT_ID);
        expect(result.text).toContain(
          'This is a sample document for DOC and DOCX parsing.',
        );
      });
    });

    describe('DOC parsing', () => {
      it('extracts text from a genuine legacy .doc via word-extractor', async () => {
        // Mammoth cannot read legacy OLE-based .doc files at all, so .doc goes
        // through word-extractor instead. This fixture is a real binary .doc
        // (not a docx renamed) — see test/fixtures/README.md.
        const { service, s3Mock } = setup();
        const docBuffer = readFileSync(
          new URL('../../test/fixtures/sample.doc', import.meta.url),
        );
        s3Mock.on(GetObjectCommand).resolves({
          Body: mockS3Body(docBuffer),
        });

        const result = await service.fetchAndParse(
          DATASET_ID,
          DOCUMENT_ID,
          'doc',
        );

        expect(result.document_id).toBe(DOCUMENT_ID);
        expect(result.text).toContain('This is a test of reviewing');
      });

      it('throws for a corrupt/non-OLE .doc buffer', async () => {
        const { service, s3Mock } = setup();
        s3Mock.on(GetObjectCommand).resolves({
          Body: mockS3Body(Buffer.from('not a real doc file')),
        });

        await expect(
          service.fetchAndParse(DATASET_ID, DOCUMENT_ID, 'doc'),
        ).rejects.toThrow();
      });
    });

    describe('unsupported file types', () => {
      it('throws for csv', async () => {
        const { service, s3Mock } = setup();
        s3Mock.on(GetObjectCommand).resolves({
          Body: mockS3Body(Buffer.from('a,b,c')),
        });

        await expect(
          service.fetchAndParse(DATASET_ID, DOCUMENT_ID, 'csv'),
        ).rejects.toThrow('Unsupported file type for parsing: "csv"');
      });

      it('throws for jsonl', async () => {
        const { service, s3Mock } = setup();
        s3Mock.on(GetObjectCommand).resolves({
          Body: mockS3Body(Buffer.from('{"a":1}')),
        });

        await expect(
          service.fetchAndParse(DATASET_ID, DOCUMENT_ID, 'jsonl'),
        ).rejects.toThrow('Unsupported file type for parsing: "jsonl"');
      });
    });
  });

  describe('storeConversionJsonl', () => {
    it('uploads JSONL to the dataset bucket with the correct metadata', async () => {
      const { service, s3Mock } = setup();
      const jsonl =
        '{"document_id":"doc-1","chunk_id":"doc-1-0","document":"hello"}\n';
      s3Mock.on(PutObjectCommand).resolves({});

      const result = await service.storeConversionJsonl(DATASET_ID, jsonl);

      expect(result.converted_dataset_file_key).toBe(
        `datasets/${DATASET_ID}/${DATASET_ID}-converted.jsonl`,
      );
      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: `datasets/${DATASET_ID}/${DATASET_ID}-converted.jsonl`,
        Body: jsonl,
        ContentType: 'application/jsonl',
        ServerSideEncryption: 'AES256',
      });
    });

    it('returns the S3 key even when upload resolves with empty output', async () => {
      const { service, s3Mock } = setup();
      const jsonl =
        '{"document_id":"doc-2","chunk_id":"doc-2-0","document":"world"}\n';
      s3Mock.on(PutObjectCommand).resolves({});

      const result = await service.storeConversionJsonl(DATASET_ID, jsonl);

      expect(result.converted_dataset_file_key).toBe(
        `datasets/${DATASET_ID}/${DATASET_ID}-converted.jsonl`,
      );
    });
  });
});
