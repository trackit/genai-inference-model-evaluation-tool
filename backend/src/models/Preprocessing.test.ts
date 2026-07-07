import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { ConvertedDatasetRow } from './Preprocessing';
import { CHUNKING_STRATEGIES, PREPROCESSING_TASK_TYPES } from './Preprocessing';

describe('Preprocessing contracts', () => {
  it('defines the supported task types and chunking strategies', () => {
    expect(PREPROCESSING_TASK_TYPES).toEqual([
      'summarization',
      'classification',
    ]);
    expect(CHUNKING_STRATEGIES).toEqual(['document', 'chapter']);
  });

  it('keeps the mock converted artifact aligned with the ConvertedDatasetRow shape', () => {
    const rows = readMockConvertedRows();

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      document_id: 'demo-dataset',
      chunk_id: 'demo-dataset-0',
      text: 'Revenue increased by 18 percent in Q2 due to growth in enterprise subscriptions and improved renewal rates.',
      summary: '',
    });

    for (const row of rows) {
      expect(row.document_id).toBe('demo-dataset');
      expect(row.chunk_id).toMatch(/^demo-dataset-\d+$/);
      expect(row.text.trim().length).toBeGreaterThan(0);
      expect(row.summary).toBe('');
    }
  });
});

function readMockConvertedRows(): ConvertedDatasetRow[] {
  const fixture = readFileSync(
    new URL('../test/fixtures/preprocessing-chunks.jsonl', import.meta.url),
    'utf8',
  );

  return fixture
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as ConvertedDatasetRow);
}
