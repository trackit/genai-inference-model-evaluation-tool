import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '@/services/apiService';
import { PreprocessingStep } from './PreprocessingStep';

describe('PreprocessingStep', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('starts preprocessing with the selected options and calls onDone on success', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      status: 'SUCCEEDED',
    });
    const onDone = vi.fn();

    render(
      <PreprocessingStep datasetId="ds1" onDone={onDone} onBack={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /classification/i }));
    fireEvent.click(screen.getByRole('button', { name: /whole document/i }));
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));

    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith('classification'),
    );
    expect(api.startPreprocessing).toHaveBeenCalledWith('ds1', {
      taskType: 'classification',
      chunkingStrategy: 'DOCUMENT',
    });
  });

  it('shows an error and a retry button on failure', async () => {
    vi.spyOn(api, 'startPreprocessing').mockResolvedValue({
      executionArn: 'arn:1',
      status: 'RUNNING',
    });
    vi.spyOn(api, 'getPreprocessingStatus').mockResolvedValue({
      status: 'FAILED',
    });

    render(
      <PreprocessingStep datasetId="ds1" onDone={() => {}} onBack={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: /retry/i }),
    ).toBeInTheDocument();
  });
});
