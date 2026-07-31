import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '@/services/apiService';
import { PreprocessingStep } from './PreprocessingStep';

describe('PreprocessingStep', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('auto-starts preprocessing on mount and calls onDone on success', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      status: 'SUCCEEDED',
    });
    const onDone = vi.fn();

    render(
      <PreprocessingStep
        datasetId="ds1"
        taskType="classification"
        chunkingStrategy="DOCUMENT"
        onDone={onDone}
        onBack={() => {}}
      />,
    );

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.startPreprocessing).toHaveBeenCalledWith('ds1', {
      taskType: 'classification',
      chunkingStrategy: 'DOCUMENT',
    });
  });

  it('shows the stage checklist while preprocessing runs', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      status: 'RUNNING',
      stage: 'GENERATING_SYNTHETIC_OUTPUTS',
    });

    render(
      <PreprocessingStep
        datasetId="ds1"
        taskType="summarization"
        chunkingStrategy="DOCUMENT"
        onDone={() => {}}
        onBack={() => {}}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('listitem', { current: 'step' }),
      ).toHaveTextContent('Generating synthetic outputs'),
    );
    expect(screen.getByText('Parsing documents')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('names the failing stage in the error message', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      status: 'FAILED',
      stage: 'DOCUMENT_PARSING',
    });

    render(
      <PreprocessingStep
        datasetId="ds1"
        taskType="summarization"
        chunkingStrategy="DOCUMENT"
        onDone={() => {}}
        onBack={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Parsing documents failed',
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('falls back to a generic message when no stage is known', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      status: 'FAILED',
    });

    render(
      <PreprocessingStep
        datasetId="ds1"
        taskType="summarization"
        chunkingStrategy="DOCUMENT"
        onDone={() => {}}
        onBack={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Preprocessing failed');
  });
});
