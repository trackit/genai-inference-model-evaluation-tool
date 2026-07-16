import { createInjectionToken } from '@trackit.io/di-container';

import { SyntheticOutputTaskType } from '../models/SyntheticOutput';
import { SyntheticOutputPromptBuilderImpl } from '../services/SyntheticOutputPromptBuilder/SyntheticOutputPromptBuilder';

export interface SyntheticOutputPromptBuilder {
  buildPrompt(input: BuildSyntheticOutputPromptInput): string;
  normalizeOutput(input: NormalizeSyntheticOutputInput): string;
}

export interface BuildSyntheticOutputPromptInput {
  document: string;
  taskType: SyntheticOutputTaskType;
}

export interface NormalizeSyntheticOutputInput {
  rawOutput: string;
  taskType: SyntheticOutputTaskType;
}

export const tokenSyntheticOutputPromptBuilder =
  createInjectionToken<SyntheticOutputPromptBuilder>(
    'SyntheticOutputPromptBuilder',
    {
      useClass: SyntheticOutputPromptBuilderImpl,
    },
  );
