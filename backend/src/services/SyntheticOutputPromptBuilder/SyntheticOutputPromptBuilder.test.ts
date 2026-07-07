import { describe, expect, it } from 'vitest';

import { BasicError } from '../../errors';
import { ConvertedDatasetRow } from '../../models/Preprocessing';
import { SyntheticOutputPromptBuilderImpl } from './SyntheticOutputPromptBuilder';

describe('SyntheticOutputPromptBuilderImpl', () => {
  const builder = new SyntheticOutputPromptBuilderImpl();

  it('builds a summarization prompt with converted row text', () => {
    const prompt = builder.buildPrompt({
      row: convertedDatasetRow({ summary: '' }),
      taskType: 'summarization',
    });

    expect(prompt).toContain('Generate a concise reference summary');
    expect(prompt).toContain('Return only the summary text');
    expect(prompt).toContain('Document ID: demo-dataset');
    expect(prompt).toContain('Chunk ID: demo-dataset-0');
    expect(prompt).toContain('Target field: summary');
    expect(prompt).toContain('Revenue increased by 18 percent');
    expect(prompt).toContain('<converted_dataset_row>');
    expect(prompt).toContain('</converted_dataset_row>');
  });

  it('builds a classification prompt that asks for one canonical label', () => {
    const prompt = builder.buildPrompt({
      row: convertedDatasetRow({ class: '' }),
      taskType: 'classification',
    });

    expect(prompt).toContain('Generate one short canonical class label');
    expect(prompt).toContain('Return only the label');
    expect(prompt).toContain('Use 1 to 4 words');
    expect(prompt).toContain('Target field: class');
    expect(prompt).toContain('Revenue increased by 18 percent');
  });

  it('normalizes summarization outputs without changing casing', () => {
    const output = builder.normalizeOutput({
      rawOutput:
        '  "Revenue increased because enterprise subscriptions grew."  ',
      taskType: 'summarization',
    });

    expect(output).toBe(
      'Revenue increased because enterprise subscriptions grew.',
    );
  });

  it('normalizes markdown-wrapped summarization outputs', () => {
    const output = builder.normalizeOutput({
      rawOutput: '```text\nRevenue increased in Q2.\n```',
      taskType: 'summarization',
    });

    expect(output).toBe('Revenue increased in Q2.');
  });

  it('normalizes classification outputs into canonical labels', () => {
    const output = builder.normalizeOutput({
      rawOutput: 'Classification label: Financial Report.',
      taskType: 'classification',
    });

    expect(output).toBe('financial_report');
  });

  it('normalizes classification label whitespace and punctuation', () => {
    const output = builder.normalizeOutput({
      rawOutput: ' "Customer Support Policy" ',
      taskType: 'classification',
    });

    expect(output).toBe('customer_support_policy');
  });

  it('rejects empty synthetic outputs', () => {
    expect(() =>
      builder.normalizeOutput({
        rawOutput: '   ',
        taskType: 'summarization',
      }),
    ).toThrow(BasicError);
  });
});

function convertedDatasetRow(
  targetField: Pick<ConvertedDatasetRow, 'summary' | 'class'>,
): ConvertedDatasetRow {
  return {
    document_id: 'demo-dataset',
    chunk_id: 'demo-dataset-0',
    text: 'Revenue increased by 18 percent in Q2 due to growth in enterprise subscriptions.',
    ...targetField,
  };
}
