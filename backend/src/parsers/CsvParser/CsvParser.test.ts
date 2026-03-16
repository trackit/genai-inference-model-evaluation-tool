import { describe, expect, it } from 'vitest';
import { CsvParser } from './CsvParser';

describe('CsvParser', () => {
  const parser = new CsvParser();

  describe('valid CSV parsing', () => {
    it('should parse CSV with all fields', () => {
      const csv = `prompt,context,reference_output
"What is AI?","AI context","Artificial Intelligence"
"Explain ML","Machine learning context","Machine Learning explanation"`;

      const result = parser.parse(csv);

      expect(result.samples).toHaveLength(2);
      expect(result.samples[0]).toEqual({
        prompt: 'What is AI?',
        context: 'AI context',
        reference_output: 'Artificial Intelligence',
      });
      expect(result.samples[1]).toEqual({
        prompt: 'Explain ML',
        context: 'Machine learning context',
        reference_output: 'Machine Learning explanation',
      });
    });

    it('should parse CSV with only prompt column', () => {
      const csv = `prompt
"What is AI?"
"Explain ML"`;

      const result = parser.parse(csv);

      expect(result.samples).toHaveLength(2);
      expect(result.samples[0]).toEqual({ prompt: 'What is AI?' });
      expect(result.samples[1]).toEqual({ prompt: 'Explain ML' });
    });

    it('should handle empty optional fields', () => {
      const csv = `prompt,context,reference_output
"What is AI?","",""
"Explain ML","",""`;

      const result = parser.parse(csv);

      expect(result.samples).toHaveLength(2);
      expect(result.samples[0]).toEqual({ prompt: 'What is AI?' });
      expect(result.samples[1]).toEqual({ prompt: 'Explain ML' });
    });

    it('should handle quoted fields with commas', () => {
      const csv = `prompt,context
"What is AI, ML, and DL?","AI, ML, and DL are related"`;

      const result = parser.parse(csv);

      expect(result.samples).toHaveLength(1);
      expect(result.samples[0].prompt).toBe('What is AI, ML, and DL?');
      expect(result.samples[0].context).toBe('AI, ML, and DL are related');
    });

    it('should handle escaped quotes', () => {
      const csv = `prompt
"She said ""Hello"""`;

      const result = parser.parse(csv);

      expect(result.samples).toHaveLength(1);
      expect(result.samples[0].prompt).toBe('She said "Hello"');
    });

    it('should skip empty lines', () => {
      const csv = `prompt
"What is AI?"

"Explain ML"`;

      const result = parser.parse(csv);

      expect(result.samples).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should throw error when prompt column is missing', () => {
      const csv = `question,answer
"What is AI?","Artificial Intelligence"`;

      expect(() => parser.parse(csv)).toThrow(
        'CSV file must contain a "prompt" column',
      );
    });

    it('should throw error for malformed CSV with column count mismatch', () => {
      const csv = `prompt,context,reference_output
"What is AI?","context"`;

      expect(() => parser.parse(csv)).toThrow('Error parsing row 2');
    });

    it('should throw error for empty CSV', () => {
      const csv = '';

      expect(() => parser.parse(csv)).toThrow(
        'CSV file must contain a header row and at least one data row',
      );
    });

    it('should throw error for CSV with only header', () => {
      const csv = 'prompt,context';

      expect(() => parser.parse(csv)).toThrow(
        'CSV file must contain a header row and at least one data row',
      );
    });

    it('should include row number in error message', () => {
      const csv = `prompt,context
"Valid prompt","Valid context"
"Invalid"`;

      expect(() => parser.parse(csv)).toThrow('Error parsing row 3');
    });
  });
});
