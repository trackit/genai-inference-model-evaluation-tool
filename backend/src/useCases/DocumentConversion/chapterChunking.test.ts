import { describe, expect, it } from 'vitest';

import {
  chunkDocumentByChapter,
  isChapterOrSectionHeading,
} from './chapterChunking';

describe('isChapterOrSectionHeading', () => {
  it.each([
  'Chapter 1',
  'CHAPTER 2: Getting Started',
  'Section 3. Results',
  'Part IV',
  '1. Introduction',
  '1.2 Methods',
  'I. Overview',
  ])('detects "%s" as a heading', (line) => {
    expect(isChapterOrSectionHeading(line)).toBe(true);
  });

  it.each([
    'This is a normal sentence in a paragraph.',
    '1. this starts lowercase and is likely a list item',
    '',
    'A'.repeat(121),
  ])('does not treat "%s" as a heading', (line) => {
    expect(isChapterOrSectionHeading(line)).toBe(false);
  });
});

describe('chunkDocumentByChapter', () => {
  const document_id = 'doc-123';

  it('splits on explicit chapter headings', () => {
    const chunks = chunkDocumentByChapter({
      document_id,
      text: [
        'Chapter 1: Introduction',
        'This chapter explains the background.',
        '',
        'Chapter 2: Methods',
        'This chapter explains the approach.',
      ].join('\n'),
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toContain('Chapter 1: Introduction');
    expect(chunks[0].text).toContain('background');
    expect(chunks[1].text).toContain('Chapter 2: Methods');
    expect(chunks[1].text).toContain('approach');
  });

  it('splits on numbered section headings', () => {
    const chunks = chunkDocumentByChapter({
      document_id,
      text: [
        '1. Introduction',
        'Opening context for the document.',
        '2. Analysis',
        'Detailed findings from the study.',
      ].join('\n'),
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toContain('1. Introduction');
    expect(chunks[1].text).toContain('2. Analysis');
  });

  it('keeps a preamble before the first detected heading', () => {
    const chunks = chunkDocumentByChapter({
      document_id,
      text: [
        'Document preamble text.',
        'Chapter 1: Body',
        'Main chapter content.',
      ].join('\n'),
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe('Document preamble text.');
    expect(chunks[1].text).toContain('Chapter 1: Body');
  });

  it('falls back to paragraph splitting when no headings are detected', () => {
    const chunks = chunkDocumentByChapter({
      document_id,
      text: 'First paragraph.\n\nSecond paragraph.',
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe('First paragraph.');
    expect(chunks[1].text).toBe('Second paragraph.');
  });

  it('returns a single chunk when there are no headings or paragraph breaks', () => {
    const chunks = chunkDocumentByChapter({
      document_id,
      text: 'A single paragraph without blank lines.',
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('A single paragraph without blank lines.');
  });
});
