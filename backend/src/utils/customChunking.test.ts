import { describe, expect, it } from 'vitest';

import { randomUUID } from 'crypto';
import {
  chunkDocumentByCustomDelimiter,
  validateCustomDelimiter,
} from './customChunking';

describe('chunkDocumentByCustomDelimiter', () => {
  const document_id = randomUUID();

  it('splits by plain string delimiter', () => {
    const chunks = chunkDocumentByCustomDelimiter(
      {
        document_id,
        text: 'A##B##C',
      },
      '##',
    );

    expect(chunks).toHaveLength(3);
    expect(chunks[0].text).toBe('A');
    expect(chunks[1].text).toBe('B');
    expect(chunks[2].text).toBe('C');
  });

  it('splits by regex delimiter', () => {
    const chunks = chunkDocumentByCustomDelimiter(
      {
        document_id,
        text: 'Chapter 1\nContent\nChapter 2\nMore content',
      },
      'Chapter \\d+',
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe('Content');
    expect(chunks[1].text).toBe('More content');
  });

  it('returns single chunk when delimiter not found', () => {
    const chunks = chunkDocumentByCustomDelimiter(
      {
        document_id,
        text: 'A single paragraph without the delimiter',
      },
      '##',
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('A single paragraph without the delimiter');
  });

  it('filters out empty chunks after splitting', () => {
    const chunks = chunkDocumentByCustomDelimiter(
      {
        document_id,
        text: '##A####B##',
      },
      '##',
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe('A');
    expect(chunks[1].text).toBe('B');
  });

  it('trims whitespace from chunks', () => {
    const chunks = chunkDocumentByCustomDelimiter(
      {
        document_id,
        text: '  A  ##  B  ',
      },
      '##',
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe('A');
    expect(chunks[1].text).toBe('B');
  });

  it('handles delimiter at start and end', () => {
    const chunks = chunkDocumentByCustomDelimiter(
      {
        document_id,
        text: '##A##',
      },
      '##',
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('A');
  });

  it('handles invalid regex as plain string', () => {
    const chunks = chunkDocumentByCustomDelimiter(
      {
        document_id,
        text: 'A[invalidB[invalidC',
      },
      '[invalid',
    );

    expect(chunks).toHaveLength(3);
    expect(chunks[0].text).toBe('A');
    expect(chunks[1].text).toBe('B');
    expect(chunks[2].text).toBe('C');
  });

  it('returns single chunk for empty document', () => {
    const chunks = chunkDocumentByCustomDelimiter(
      {
        document_id,
        text: '',
      },
      '##',
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('');
  });
});

describe('validateCustomDelimiter', () => {
  it('accepts valid delimiter of length 1', () => {
    expect(() => validateCustomDelimiter('#')).not.toThrow();
  });

  it('accepts valid delimiter of length 50', () => {
    const delimiter = 'a'.repeat(50);
    expect(() => validateCustomDelimiter(delimiter)).not.toThrow();
  });

  it('throws for empty delimiter', () => {
    expect(() => validateCustomDelimiter('')).toThrow(
      'Custom delimiter must be between 1 and 50 characters',
    );
  });

  it('throws for delimiter over 50 characters', () => {
    const delimiter = 'a'.repeat(51);
    expect(() => validateCustomDelimiter(delimiter)).toThrow(
      'Custom delimiter must be between 1 and 50 characters',
    );
  });

  it('accepts undefined delimiter', () => {
    expect(() => validateCustomDelimiter(undefined)).not.toThrow();
  });
});
