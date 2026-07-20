import { createInjectionToken } from '@trackit.io/di-container';

import { BasicError, BasicErrorType } from '../../errors';
import {
  BuildSyntheticOutputPromptInput,
  NormalizeSyntheticOutputInput,
  SyntheticOutputPromptBuilder,
} from '../../ports/SyntheticOutputPromptBuilder';

export class SyntheticOutputPromptBuilderImpl implements SyntheticOutputPromptBuilder {
  buildPrompt({ document, taskType }: BuildSyntheticOutputPromptInput): string {
    const instructions =
      taskType === 'summarization'
        ? [
            'Generate a concise reference summary for the text below.',
            'Return only the summary text. Do not include markdown, labels, or explanations.',
          ]
        : [
            'Generate one short canonical class label for the text below.',
            'Return only the label. Use 1 to 4 words. Do not include markdown, explanations, or confidence scores.',
          ];

    return [...instructions, '', document.trim()].join('\n');
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

export const tokenSyntheticOutputPromptBuilder =
  createInjectionToken<SyntheticOutputPromptBuilder>(
    'SyntheticOutputPromptBuilder',
    {
      useClass: SyntheticOutputPromptBuilderImpl,
    },
  );
