import { describe, expect, it } from 'vitest';

import { FakeSyntheticOutputModelClient } from './FakeSyntheticOutputModelClient';

describe('FakeSyntheticOutputModelClient', () => {
  it('records generation requests and returns queued outputs', async () => {
    const client = new FakeSyntheticOutputModelClient();
    client.queueOutput('Generated summary');

    const result = await client.generate({
      prompt: 'Summarize this text',
      modelId: 'test-model',
    });

    expect(result).toEqual({
      output: 'Generated summary',
      modelId: 'test-model',
    });
    expect(client.requests).toEqual([
      {
        prompt: 'Summarize this text',
        modelId: 'test-model',
      },
    ]);
  });

  it('returns deterministic default output when no output is queued', async () => {
    const client = new FakeSyntheticOutputModelClient();

    const result = await client.generate({ prompt: 'Classify this text' });

    expect(result).toEqual({
      output: 'fake synthetic output',
      modelId: 'fake-synthetic-output-model',
    });
  });

  it('returns queued outputs in order', async () => {
    const client = new FakeSyntheticOutputModelClient();
    client.queueOutput('First output');
    client.queueOutput('Second output');

    await expect(client.generate({ prompt: 'First prompt' })).resolves.toEqual({
      output: 'First output',
      modelId: 'fake-synthetic-output-model',
    });
    await expect(client.generate({ prompt: 'Second prompt' })).resolves.toEqual(
      {
        output: 'Second output',
        modelId: 'fake-synthetic-output-model',
      },
    );
  });

  it('throws queued errors', async () => {
    const client = new FakeSyntheticOutputModelClient();
    client.queueError(new Error('model failed'));

    await expect(client.generate({ prompt: 'Prompt' })).rejects.toThrow(
      'model failed',
    );
  });
});
