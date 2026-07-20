import { SyntheticOutputTaskType } from '../models/SyntheticOutput';

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
