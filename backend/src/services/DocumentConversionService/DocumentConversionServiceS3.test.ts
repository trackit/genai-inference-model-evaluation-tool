import { chunkDocumentByChapter } from 'backend/src/utils/chapterChunking';
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
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

describe('DocumentConversionService', () => {
  describe('parse', () => {
    describe('PDF parsing', () => {
      it('extracts text from PDF', async () => {
        const service = new DocumentConversionServiceImpl();

        const result = await service.parse(buildMinimalPdf('Hello PDF'), 'pdf');

        expect(result).toContain('Hello PDF');
      });

      it('trims extracted text', async () => {
        const service = new DocumentConversionServiceImpl();

        const result = await service.parse(buildMinimalPdf('Hello PDF'), 'pdf');

        expect(result).toBe(result.trim());
      });

      it('throws on corrupt PDF buffer', async () => {
        const service = new DocumentConversionServiceImpl();

        await expect(
          service.parse(Buffer.from('not a pdf'), 'pdf'),
        ).rejects.toThrow();
      });
    });

    describe('DOCX parsing', () => {
      it('extracts text from docx', async () => {
        const service = new DocumentConversionServiceImpl();

        const docxBuffer = readFileSync(
          new URL('../../test/fixtures/sample.docx', import.meta.url),
        );

        const result = await service.parse(docxBuffer, 'docx');

        expect(result).toContain(
          'This is a sample document for DOC and DOCX parsing.',
        );
      });
    });

    describe('DOC parsing', () => {
      it('extracts text from doc', async () => {
        const service = new DocumentConversionServiceImpl();

        const docBuffer = readFileSync(
          new URL('../../test/fixtures/sample.doc', import.meta.url),
        );

        const result = await service.parse(docBuffer, 'doc');

        expect(result).toContain('This is a test of reviewing');
      });

      it('regression: preserves paragraph boundaries so a headingless .doc still chunks into multiple pieces', async () => {
        const service = new DocumentConversionServiceImpl();
        const docBuffer = readFileSync(
          new URL('../../test/fixtures/sample.doc', import.meta.url),
        );
        const extractedText = await service.parse(docBuffer, 'doc');

        const chunks = chunkDocumentByChapter({
          document_id: 'doc-1',
          text: extractedText,
        });

        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.map((chunk) => chunk.text)).toEqual([
          'A second test of reviewing, but with Unicode characters in to see if character offsets get broken. 😀 ∀',
          'This is a test of reviewing',
          'This text has been inserted, ✻and should be included',
        ]);
      });
    });
  });
});
