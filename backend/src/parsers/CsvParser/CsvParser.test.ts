import { describe, expect, it } from 'vitest';
import { CsvParserImpl } from './CsvParser';

describe('CsvParser', () => {
  const parser = new CsvParserImpl();

  describe('valid CSV parsing', () => {
    it('should parse CSV with all fields', () => {
      const csv = `document,summary,class
"What is AI?","Artificial Intelligence","tech"
"Explain ML","Machine Learning explanation","tech"`;

      const result = parser.parse(csv);

      expect(result.samples).toHaveLength(2);
      expect(result.samples[0]).toEqual({
        document: 'What is AI?',
        summary: 'Artificial Intelligence',
        class_label: 'tech',
      });
      expect(result.samples[1]).toEqual({
        document: 'Explain ML',
        summary: 'Machine Learning explanation',
        class_label: 'tech',
      });
    });

    it('should parse CSV with only document column', () => {
      const csv = `document
"What is AI?"
"Explain ML"`;

      const result = parser.parse(csv);

      expect(result.samples).toHaveLength(2);
      expect(result.samples[0]).toEqual({ document: 'What is AI?' });
      expect(result.samples[1]).toEqual({ document: 'Explain ML' });
    });

    it('should handle empty optional fields', () => {
      const csv = `document,summary,class
"What is AI?","",""
"Explain ML","",""`;

      const result = parser.parse(csv);

      expect(result.samples).toHaveLength(2);
      expect(result.samples[0]).toEqual({ document: 'What is AI?' });
      expect(result.samples[1]).toEqual({ document: 'Explain ML' });
    });

    it('should handle quoted fields with commas', () => {
      const csv = `document,summary
"What is AI, ML, and DL?","AI, ML, and DL are related"`;

      const result = parser.parse(csv);

      expect(result.samples).toHaveLength(1);
      expect(result.samples[0].document).toBe('What is AI, ML, and DL?');
      expect(result.samples[0].summary).toBe('AI, ML, and DL are related');
    });

    it('should handle escaped quotes', () => {
      const csv = `document
"She said ""Hello"""`;

      const result = parser.parse(csv);

      expect(result.samples).toHaveLength(1);
      expect(result.samples[0].document).toBe('She said "Hello"');
    });

    it('should skip empty lines', () => {
      const csv = `document
"What is AI?"

"Explain ML"`;

      const result = parser.parse(csv);

      expect(result.samples).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should throw error when document column is missing', () => {
      const csv = `question,answer
"What is AI?","Artificial Intelligence"`;

      expect(() => parser.parse(csv)).toThrow(
        'CSV file must contain a "document" column',
      );
    });

    it('should throw error for malformed CSV with column count mismatch', () => {
      const csv = `document,summary
"What is AI?"`;

      expect(() => parser.parse(csv)).toThrow('Expected 2 columns but found 1');
    });

    it('should throw error for empty CSV', () => {
      expect(() => parser.parse('')).toThrow(
        'CSV file must contain a header row and at least one data row',
      );
    });

    it('should throw error for CSV with only header', () => {
      expect(() => parser.parse('document,summary')).toThrow(
        'CSV file must contain a header row and at least one data row',
      );
    });

    it('should include row number in error message', () => {
      const csv = `document,summary
"Valid document","Valid summary"
"Invalid"`;

      expect(() => parser.parse(csv)).toThrow('Expected 2 columns but found 1');
    });
  });
});
