import { describe, expect, it } from 'vitest';
import { JsonlParserImpl } from './JsonlParser';

describe('JsonlParser', () => {
  const parser = new JsonlParserImpl();

  describe('valid JSONL parsing', () => {
    it('should parse JSONL with all fields', () => {
      const jsonl = `{"document":"What is AI?","summary":"Artificial Intelligence","class":"tech"}
{"document":"Explain ML","summary":"Machine Learning explanation","class":"tech"}`;

      const result = parser.parse(jsonl);

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

    it('should parse JSONL with only document field', () => {
      const jsonl = `{"document":"What is AI?"}
{"document":"Explain ML"}`;

      const result = parser.parse(jsonl);

      expect(result.samples).toHaveLength(2);
      expect(result.samples[0]).toEqual({ document: 'What is AI?' });
      expect(result.samples[1]).toEqual({ document: 'Explain ML' });
    });

    it('should handle empty optional fields', () => {
      const jsonl = `{"document":"What is AI?","summary":"","class":""}
{"document":"Explain ML","summary":"","class":""}`;

      const result = parser.parse(jsonl);

      expect(result.samples).toHaveLength(2);
      expect(result.samples[0]).toEqual({ document: 'What is AI?' });
      expect(result.samples[1]).toEqual({ document: 'Explain ML' });
    });

    it('should skip empty lines', () => {
      const jsonl = `{"document":"What is AI?"}

{"document":"Explain ML"}`;

      const result = parser.parse(jsonl);

      expect(result.samples).toHaveLength(2);
    });

    it('should preserve summary field when provided', () => {
      const jsonl = `{"document":"Summarize this","summary":"Short summary"}`;

      const result = parser.parse(jsonl);

      expect(result.samples).toHaveLength(1);
      expect(result.samples[0]).toEqual({
        document: 'Summarize this',
        summary: 'Short summary',
      });
    });

    it('should preserve class field as class_label when provided', () => {
      const jsonl = `{"document":"This movie was great","class":"positive"}`;

      const result = parser.parse(jsonl);

      expect(result.samples).toHaveLength(1);
      expect(result.samples[0]).toEqual({
        document: 'This movie was great',
        class_label: 'positive',
      });
    });

    it('should return empty samples for empty JSONL', () => {
      const result = parser.parse('');
      expect(result.samples).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should throw error when document field is missing', () => {
      const jsonl = `{"question":"What is AI?","answer":"Artificial Intelligence"}`;

      expect(() => parser.parse(jsonl)).toThrow(
        'Each line must contain a "document" field',
      );
    });

    it('should throw error for malformed JSON', () => {
      const jsonl = `{"document":"What is AI?"
{"document":"Explain ML"}`;

      expect(() => parser.parse(jsonl)).toThrow(
        'Error parsing line 1: Invalid JSON',
      );
    });

    it('should include line number in error message for invalid JSON', () => {
      const jsonl = `{"document":"Valid"}
{invalid json}
{"document":"Another valid"}`;

      expect(() => parser.parse(jsonl)).toThrow(
        'Error parsing line 2: Invalid JSON',
      );
    });

    it('should include line number in error message for missing document', () => {
      const jsonl = `{"document":"Valid"}
{"question":"Missing document field"}`;

      expect(() => parser.parse(jsonl)).toThrow(
        'Each line must contain a "document" field',
      );
    });
  });
});
