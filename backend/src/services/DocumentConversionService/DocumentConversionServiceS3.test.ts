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

    describe('PDF section chunking regression', () => {
      it('splits the parsed sample.pdf into logical sections', async () => {
        const service = new DocumentConversionServiceImpl();

        const pdfBuffer = readFileSync(
          new URL('../../test/fixtures/sample-1.pdf', import.meta.url),
        );

        const extracted = await service.parse(pdfBuffer, 'pdf');

        const chunks = chunkDocumentBySection({
          document_id: 'pdf-1',
          text: extracted,
        });

        expect(chunks.length).toBe(6);

        expect(chunks.every((chunk) => chunk.text.trim().length > 50)).toBe(
          true,
        );
      });

      it('does not include the table of contents as a chunk', async () => {
        const service = new DocumentConversionServiceImpl();

        const pdfBuffer = readFileSync(
          new URL('../../test/fixtures/sample-1.pdf', import.meta.url),
        );

        const extracted = await service.parse(pdfBuffer, 'pdf');

        const chunks = chunkDocumentBySection({
          document_id: 'pdf-1',
          text: extracted,
        });

        expect(
          chunks.some((chunk) => /table\s+of\s+contents/i.test(chunk.text)),
        ).toBe(false);

        expect(chunks.some((chunk) => /\.\.\.\.\.\./.test(chunk.text))).toBe(
          false,
        );
      });

      it('chunks start with the real section titles from the parsed pdf', async () => {
        const service = new DocumentConversionServiceImpl();

        const pdfBuffer = readFileSync(
          new URL('../../test/fixtures/sample-1.pdf', import.meta.url),
        );

        const extracted = await service.parse(pdfBuffer, 'pdf');

        const chunks = chunkDocumentBySection({
          document_id: 'pdf-1',
          text: extracted,
        });

        expect(chunks[1].text).toContain('Introduction');
        expect(chunks[2].text).toContain('System Architecture');
        expect(chunks[3].text).toContain('Implementation Details');
        expect(chunks[5].text).toContain('Conclusion');
      });

      it('keeps paragraphs belonging to the same section in one chunk', async () => {
        const service = new DocumentConversionServiceImpl();

        const pdfBuffer = readFileSync(
          new URL('../../test/fixtures/sample-1.pdf', import.meta.url),
        );

        const extracted = await service.parse(pdfBuffer, 'pdf');

        const chunks = chunkDocumentBySection({
          document_id: 'pdf-1',
          text: extracted,
        });
        expect(chunks).toHaveLength(6);
        expect(chunks[1].text).toContain('Software engineering projects ');
        expect(chunks[1].text).toContain('A good architecture');
        expect(chunks[1].text).toContain('section explains the main');
      });

      it('does not split paragraphs mid-sentence at inline citations', async () => {
        const service = new DocumentConversionServiceImpl();
        const pdfBuffer = readFileSync(
          new URL('../../test/fixtures/mixOfTestsDoc.pdf', import.meta.url),
        );

        const extracted = await service.parse(pdfBuffer, 'pdf');
        const chunks = chunkDocumentBySection({
          document_id: 'pdf-edge-2',
          text: extracted,
        });
        const testingChunk = chunks.find((c) =>
          c.text.includes('Testing is an essential part'),
        );
        expect(chunks.length).toBe(6);
        expect(testingChunk).toBeDefined();
        expect(testingChunk!.text).toContain('communication between');
        expect(testingChunk!.text).toContain(
          'multiple modules.(As discussed in Chapter 3)',
        );

        const citationChunk = chunks.find((c) =>
          c.text.startsWith('multiple modules'),
        );
        expect(citationChunk).toBeUndefined();
      });

      it('correctly identifies weirdly formatted headings as section starts', async () => {
        const service = new DocumentConversionServiceImpl();
        const pdfBuffer = readFileSync(
          new URL('../../test/fixtures/mixOfTestsDoc.pdf', import.meta.url),
        );

        const extracted = await service.parse(pdfBuffer, 'pdf');
        const chunks = chunkDocumentBySection({
          document_id: 'pdf-edge-3',
          text: extracted,
        });
        expect(chunks.length).toBe(6);
        expect(
          chunks.some((c) => c.text.startsWith('A. System Architecture')),
        ).toBe(true);
        expect(
          chunks.some((c) => c.text.startsWith('ii. Implementation Details')),
        ).toBe(true);
        expect(chunks.some((c) => c.text.startsWith('Section 9 :'))).toBe(true);
        expect(
          chunks.some((c) => c.text.startsWith('Appendix A.1 : Conclusion')),
        ).toBe(true);
      });
    });

    describe('DOCX section chunking regression', () => {
      it('keeps paragraphs from the same section together', async () => {
        const service = new DocumentConversionServiceImpl();

        const docxBuffer = readFileSync(
          new URL('../../test/fixtures/sample-2.docx', import.meta.url),
        );

        const extracted = await service.parse(docxBuffer, 'docx');

        const chunks = chunkDocumentBySection({
          document_id: 'docx-1',
          text: extracted,
        });

        expect(chunks[0].text).toContain('Introduction');
        expect(chunks[1].text).toContain('engineering projects');
        expect(chunks[1].text).toContain(
          'This section explains the main objectives',
        );
        expect(chunks[5].text).toContain('combined with effective');
        expect(chunks[5].text).toContain(
          'Future improvements can focus on automation, monitoring, and continuous delivery.',
        );
      });

      it('does not split solely on blank lines inside a section', async () => {
        const service = new DocumentConversionServiceImpl();

        const docxBuffer = readFileSync(
          new URL('../../test/fixtures/sample-2.docx', import.meta.url),
        );

        const extracted = await service.parse(docxBuffer, 'docx');

        const chunks = chunkDocumentBySection({
          document_id: 'docx-1',
          text: extracted,
        });

        expect(chunks).toHaveLength(6);
      });
    });

    describe('DOC section chunking regression', () => {
      it('keeps paragraphs from the same section together', async () => {
        const service = new DocumentConversionServiceImpl();

        const docBuffer = readFileSync(
          new URL('../../test/fixtures/sample-1.doc', import.meta.url),
        );

        const extracted = await service.parse(docBuffer, 'doc');

        const chunks = chunkDocumentBySection({
          document_id: 'doc-1',
          text: extracted,
        });

        expect(chunks).toHaveLength(6);

        expect(chunks[0].text).toContain('Introduction');
        expect(chunks[1].text).toContain('engineering projects');
        expect(chunks[1].text).toContain(
          'This section explains the main objectives',
        );
        expect(chunks[5].text).toContain('combined with effective');
        expect(chunks[5].text).toContain(
          'Future improvements can focus on automation, monitoring, and continuous delivery.',
        );
      });
    });
  });
});
