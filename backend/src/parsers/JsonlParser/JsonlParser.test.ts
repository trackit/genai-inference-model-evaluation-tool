import { describe, expect, it } from 'vitest';

describe('JsonlParser', () => {
  const parser = new JsonlParser();

  describe('valid JSONL parsing', () => {
    it('should parse JSONL with all fields', () => {
      const jsonl = `{"prompt":"What is AI?","context":"AI context","reference_output":"Artificial Intelligence"}
{"prompt":"Explain ML","context":"Machine learning context","reference_output":"Machine Learning explanation"}`;

      const result = parser.parse(jsonl);

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

    it('should parse JSONL with only prompt field', () => {
      const jsonl = `{"prompt":"What is AI?"}
{"prompt":"Explain ML"}`;

      const result = parser.parse(jsonl);

      expect(result.samples).toHaveLength(2);
      expect(result.samples[0]).toEqual({ prompt: 'What is AI?' });
      expect(result.samples[1]).toEqual({ prompt: 'Explain ML' });
    });

    it('should handle empty optional fields', () => {
      const jsonl = `{"prompt":"What is AI?","context":"","reference_output":""}
{"prompt":"Explain ML","context":"","reference_output":""}`;

      const result = parser.parse(jsonl);

      expect(result.samples).toHaveLength(2);
      expect(result.samples[0]).toEqual({ prompt: 'What is AI?' });
      expect(result.samples[1]).toEqual({ prompt: 'Explain ML' });
    });

    it('should skip empty lines', () => {
      const jsonl = `{"prompt":"What is AI?"}

{"prompt":"Explain ML"}`;

      const result = parser.parse(jsonl);

      expect(result.samples).toHaveLength(2);
    });

    it('should handle complex JSON values', () => {
      const jsonl = `{"prompt":"What is AI?","context":"AI includes: ML, DL, NLP","reference_output":"Artificial Intelligence"}`;

      const result = parser.parse(jsonl);

      expect(result.samples).toHaveLength(1);
      expect(result.samples[0].context).toBe('AI includes: ML, DL, NLP');
    });

    it('should preserve context field when provided', () => {
      const jsonl = `{"prompt":"Summarize this","context":"Long article text here"}`;

      const result = parser.parse(jsonl);

      expect(result.samples).toHaveLength(1);
      expect(result.samples[0]).toEqual({
        prompt: 'Summarize this',
        context: 'Long article text here',
      });
    });

    it('should preserve reference_output field when provided', () => {
      const jsonl = `{"prompt":"What is AI?","reference_output":"Artificial Intelligence"}`;

      const result = parser.parse(jsonl);

      expect(result.samples).toHaveLength(1);
      expect(result.samples[0]).toEqual({
        prompt: 'What is AI?',
        reference_output: 'Artificial Intelligence',
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when prompt field is missing', () => {
      const jsonl = `{"question":"What is AI?","answer":"Artificial Intelligence"}`;

      expect(() => parser.parse(jsonl)).toThrow(
        'Each line must contain a "prompt" field',
      );
    });

    it('should throw error for malformed JSON', () => {
      const jsonl = `{"prompt":"What is AI?"
{"prompt":"Explain ML"}`;

      expect(() => parser.parse(jsonl)).toThrow(
        'Error parsing line 1: Invalid JSON',
      );
    });

    it('should return empty samples for empty JSONL', () => {
      const jsonl = '';

      const result = parser.parse(jsonl);

      expect(result.samples).toHaveLength(0);
    });

    it('should include line number in error message for invalid JSON', () => {
      const jsonl = `{"prompt":"Valid"}
{invalid json}
{"prompt":"Another valid"}`;

      expect(() => parser.parse(jsonl)).toThrow(
        'Error parsing line 2: Invalid JSON',
      );
    });

    it('should include line number in error message for missing prompt', () => {
      const jsonl = `{"prompt":"Valid"}
{"question":"Missing prompt field"}`;

      expect(() => parser.parse(jsonl)).toThrow('Error parsing line 2');
    });

    it('should provide descriptive error with line number for malformed JSON', () => {
      const jsonl = `{"prompt":"First line"}
{"prompt":"Second line"
{"prompt":"Third line"}`;

      expect(() => parser.parse(jsonl)).toThrow(
        'Error parsing line 2: Invalid JSON',
      );
    });
  });
});
