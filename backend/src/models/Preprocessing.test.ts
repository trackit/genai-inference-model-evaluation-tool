import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { DocumentChunk } from './Preprocessing';
import { CHUNKING_STRATEGIES, PREPROCESSING_TASK_TYPES } from './Preprocessing';

describe('Preprocessing contracts', () => {
  it('defines the supported task types and chunking strategies', () => {
    expect(PREPROCESSING_TASK_TYPES).toEqual([
      'summarization',
      'classification',
    ]);
    expect(CHUNKING_STRATEGIES).toEqual(['document', 'chapter']);
  });

  it('keeps the mock chunk artifact aligned with the DocumentChunk shape', () => {
    const chunks = readMockChunks();

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({
      chunk_id: 'chunk-001',
      document_id: 'doc-001',
      source_filename: 'quarterly-report.pdf',
      chunk_index: 0,
      metadata: {
        section_title: 'Executive Summary',
        page_start: 1,
        page_end: 1,
      },
    });

    for (const chunk of chunks) {
      expect(chunk.chunk_id).toMatch(/^chunk-/);
      expect(chunk.document_id).toMatch(/^doc-/);
      expect(chunk.source_filename).toMatch(/\.(pdf|doc)$/);
      expect(Number.isInteger(chunk.chunk_index)).toBe(true);
      expect(chunk.text.trim().length).toBeGreaterThan(0);
    }
  });
});

function readMockChunks(): DocumentChunk[] {
  const fixture = readFileSync(
    new URL('../test/fixtures/preprocessing-chunks.jsonl', import.meta.url),
    'utf8',
  );

  return fixture
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as DocumentChunk);
}
