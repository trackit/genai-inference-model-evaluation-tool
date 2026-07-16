import { BasicError, BasicErrorType } from '../../errors';
import { ConvertedDatasetRow } from '../../models/Preprocessing';
import {
  BuildSyntheticOutputPromptInput,
  NormalizeSyntheticOutputInput,
  SyntheticOutputPromptBuilder,
} from '../../ports/SyntheticOutputPromptBuilder';

export class SyntheticOutputPromptBuilderImpl implements SyntheticOutputPromptBuilder {
  buildPrompt({ row, taskType }: BuildSyntheticOutputPromptInput): string {
    return taskType === 'summarization'
      ? buildSummarizationPrompt(row)
      : buildClassificationPrompt(row);
  }

  normalizeOutput({
    rawOutput,
    taskType,
  }: NormalizeSyntheticOutputInput): string {
    const cleaned = stripWrappingPunctuation(rawOutput).replace(/\s+/g, ' ');

    if (!cleaned) {
      throw new BasicError(
        BasicErrorType.UNPROCESSABLE_ENTITY,
        'EMPTY_SYNTHETIC_OUTPUT',
        'Synthetic output cannot be empty',
      );
    }

    return taskType === 'classification'
      ? normalizeClassificationLabel(cleaned)
      : cleaned;
  }
}

function buildSummarizationPrompt(row: ConvertedDatasetRow): string {
  return [
    'Generate a concise reference summary for the converted dataset row below.',
    'Return only the summary text. Do not include markdown, labels, or explanations.',
    '',
    formatConvertedDatasetRowContext(row),
  ].join('\n');
}

function buildClassificationPrompt(row: ConvertedDatasetRow): string {
  return [
    'Generate one short canonical class label for the converted dataset row below.',
    'Return only the label. Use 1 to 4 words. Do not include markdown, explanations, or confidence scores.',
    '',
    formatConvertedDatasetRowContext(row),
  ].join('\n');
}

function formatConvertedDatasetRowContext(row: ConvertedDatasetRow): string {
  const contextLines = [
    `Document ID: ${row.document_id}`,
    `Chunk ID: ${row.chunk_id}`,
  ];

  if (row.summary !== undefined) {
    contextLines.push('Target field: summary');
  }

  if (row.class !== undefined) {
    contextLines.push('Target field: class');
  }

  return [
    '<converted_dataset_row>',
    ...contextLines,
    '',
    row.document.trim(),
    '</converted_dataset_row>',
  ].join('\n');
}

function stripWrappingPunctuation(value: string): string {
  return value
    .trim()
    .replace(/^```(?:\w+)?\s*/u, '')
    .replace(/\s*```$/u, '')
    .replace(/^["'`]+/u, '')
    .replace(/["'`]+$/u, '')
    .trim();
}

function normalizeClassificationLabel(value: string): string {
  return value
    .replace(/^class(?:ification)?\s*(?:label)?\s*:\s*/iu, '')
    .replace(/[.。]+$/u, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}
