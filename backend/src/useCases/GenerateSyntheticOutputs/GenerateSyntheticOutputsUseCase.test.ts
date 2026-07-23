import { register, reset } from '@trackit.io/di-container';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenSyntheticOutputModelClient } from '../../services/SyntheticOutputModelClient/BedrockSyntheticOutputModelClient';
import { tokenSyntheticOutputPromptBuilder } from '../../services/SyntheticOutputPromptBuilder/SyntheticOutputPromptBuilder';
import { GenerateSyntheticOutputsUseCaseImpl } from './GenerateSyntheticOutputsUseCase';

describe('GenerateSyntheticOutputsUseCase.generateSyntheticRow', () => {
  const generate = vi.fn();

  beforeEach(() => {
    reset();
    vi.clearAllMocks();
    register(tokenSyntheticOutputPromptBuilder, {
      useValue: {
        buildPrompt: () => 'prompt',
        normalizeOutput: ({ rawOutput }: { rawOutput: string }) => rawOutput,
      },
    });
    register(tokenSyntheticOutputModelClient, { useValue: { generate } });
  });

  it('returns a completed row on success', async () => {
    generate.mockResolvedValue({ output: 'a summary', modelId: 'm1' });
    const useCase = new GenerateSyntheticOutputsUseCaseImpl();

    const row = await useCase.generateSyntheticRow({
      convertedRow: { chunk_id: 'c1', document_id: 'd1', document: 'text' },
      taskType: 'summarization',
    });

    expect(row).toMatchObject({
      chunk_id: 'c1',
      document_id: 'd1',
      text: 'text',
      summary: 'a summary',
      status: 'completed',
      model_id: 'm1',
    });
  });

  it('throws when the model call fails', async () => {
    generate.mockRejectedValue(new Error('bedrock down'));
    const useCase = new GenerateSyntheticOutputsUseCaseImpl();

    await expect(
      useCase.generateSyntheticRow({
        convertedRow: { chunk_id: 'c1', document_id: 'd1', document: 'text' },
        taskType: 'summarization',
      }),
    ).rejects.toThrow('bedrock down');
  });
});
