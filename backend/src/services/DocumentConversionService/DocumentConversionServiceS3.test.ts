import { inject, reset } from '@trackit.io/di-container';
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { tokenDatasetService } from '../DatasetService/DatasetServiceS3';
import { FakeDatasetService } from '../DatasetService/FakeDatasetService';
import { DocumentConversionServiceImpl } from './DocumentConversionServiceS3';

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

  for (const offset of offsets) {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  body += `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return Buffer.from(body);
}

const DATASET_ID = 'a1b2c3d4-0000-0000-0000-000000000001';
const DOCUMENT_ID = 'e5f6a7b8-0000-0000-0000-000000000002';

const setup = () => {
  reset();
  registerTestInfrastructure();

  const service = new DocumentConversionServiceImpl();

  const datasetService = inject(tokenDatasetService) as FakeDatasetService;

  return {
    service,
    datasetService,
  };
};

const addRawContent = (
  datasetService: FakeDatasetService,
  fileType: 'pdf' | 'doc' | 'docx' | 'csv',
  content: Buffer,
) => {
  datasetService.rawContents.push({
    datasetId: DATASET_ID,
    documentId: DOCUMENT_ID,
    fileType,
    content,
  });
};

describe('DocumentConversionService', () => {
  describe('fetchAndParse', () => {
    describe('PDF parsing', () => {
      it('extracts text from PDF', async () => {
        const { service, datasetService } = setup();

        addRawContent(datasetService, 'pdf', buildMinimalPdf('Hello PDF'));

        const result = await service.fetchAndParse(
          DATASET_ID,
          DOCUMENT_ID,
          'pdf',
        );

        expect(result).toEqual({
          document_id: DOCUMENT_ID,
          text: expect.stringContaining('Hello PDF'),
        });
      });

      it('trims extracted text', async () => {
        const { service, datasetService } = setup();

        addRawContent(datasetService, 'pdf', buildMinimalPdf('Hello PDF'));

        const result = await service.fetchAndParse(
          DATASET_ID,
          DOCUMENT_ID,
          'pdf',
        );

        expect(result.text).toBe(result.text.trim());
      });

      it('throws on corrupt PDF buffer', async () => {
        const { service, datasetService } = setup();

        addRawContent(datasetService, 'pdf', Buffer.from('not a pdf'));

        await expect(
          service.fetchAndParse(DATASET_ID, DOCUMENT_ID, 'pdf'),
        ).rejects.toThrow();
      });
    });

    describe('DOCX parsing', () => {
      it('extracts text from docx', async () => {
        const { service, datasetService } = setup();

        const docxBuffer = readFileSync(
          new URL('../../test/fixtures/sample.docx', import.meta.url),
        );

        addRawContent(datasetService, 'docx', docxBuffer);

        const result = await service.fetchAndParse(
          DATASET_ID,
          DOCUMENT_ID,
          'docx',
        );

        expect(result.text).toContain(
          'This is a sample document for DOC and DOCX parsing.',
        );
      });
    });

    describe('DOC parsing', () => {
      it('extracts text from doc', async () => {
        const { service, datasetService } = setup();

        const docBuffer = readFileSync(
          new URL('../../test/fixtures/sample.doc', import.meta.url),
        );

        addRawContent(datasetService, 'doc', docBuffer);

        const result = await service.fetchAndParse(
          DATASET_ID,
          DOCUMENT_ID,
          'doc',
        );

        expect(result.text).toContain('This is a test of reviewing');
      });
    });

    describe('errors', () => {
      it('propagates missing raw content error', async () => {
        const { service } = setup();

        await expect(
          service.fetchAndParse(DATASET_ID, DOCUMENT_ID, 'pdf'),
        ).rejects.toThrow('Raw document content not found');
      });

      it('throws for unsupported file type', async () => {
        const { service, datasetService } = setup();

        addRawContent(datasetService, 'csv', Buffer.from('anything'));

        await expect(
          service.fetchAndParse(DATASET_ID, DOCUMENT_ID, 'csv'),
        ).rejects.toThrow('Unsupported file type for parsing: "csv"');
      });
    });
  });
});
