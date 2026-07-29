import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { chunkDocumentBySection } from '../../utils/chapterChunking';
import { DocumentConversionServiceImpl } from './DocumentConversionServiceS3';

describe('DocumentConversionService', () => {
  describe('parse', () => {
    describe('PDF parsing', () => {
      it('extracts text from PDF', async () => {
        const service = new DocumentConversionServiceImpl();
        const pdfBuffer = readFileSync(
          new URL('../../test/fixtures/sample.pdf', import.meta.url),
        );
        const result = await service.parse(pdfBuffer, 'pdf');

        expect(result).toContain('This is a sample document for PDF parsing.');
        expect(result).toContain(
          'Chapter 1: Fixture text for conversion tests.',
        );
      });

      it('trims extracted text', async () => {
        const service = new DocumentConversionServiceImpl();

        const pdfBuffer = readFileSync(
          new URL('../../test/fixtures/sample.pdf', import.meta.url),
        );
        const result = await service.parse(pdfBuffer, 'pdf');

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

      it('regression: detects a real chapter heading extracted by Mammoth and splits on it', async () => {
        const service = new DocumentConversionServiceImpl();
        const docxBuffer = readFileSync(
          new URL('../../test/fixtures/sample.docx', import.meta.url),
        );
        const extractedText = await service.parse(docxBuffer, 'docx');

        const chunks = chunkDocumentBySection({
          document_id: 'docx-1',
          text: extractedText,
        });

        expect(chunks).toEqual([
          {
            document_id: 'docx-1',
            chunk_id: 'docx-1-0',
            text: 'This is a sample document for DOC and DOCX parsing.',
          },
          {
            document_id: 'docx-1',
            chunk_id: 'docx-1-1',
            text: 'Chapter 1: Fixture text for conversion tests.',
          },
        ]);
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

        const chunks = chunkDocumentBySection({
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
