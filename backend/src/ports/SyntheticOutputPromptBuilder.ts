import { createInjectionToken } from '@trackit.io/di-container';

import {
  ConvertedDatasetRow,
  PreprocessingTaskType,
} from '../models/Preprocessing';
import { SyntheticOutputPromptBuilderImpl } from '../services/SyntheticOutputPromptBuilder/SyntheticOutputPromptBuilder';

export interface SyntheticOutputPromptBuilder {
  buildPrompt(input: BuildSyntheticOutputPromptInput): string;
  normalizeOutput(input: NormalizeSyntheticOutputInput): string;
}

export interface BuildSyntheticOutputPromptInput {
  row: ConvertedDatasetRow;
  taskType: PreprocessingTaskType;
}

export interface NormalizeSyntheticOutputInput {
  rawOutput: string;
  taskType: PreprocessingTaskType;
}

export const tokenSyntheticOutputPromptBuilder =
  createInjectionToken<SyntheticOutputPromptBuilder>(
    'SyntheticOutputPromptBuilder',
    {
      useClass: SyntheticOutputPromptBuilderImpl,
    },
  );
