import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_METRICS_TOGGLES } from '@/types/evaluation';

import { MetricsPicker } from './MetricsPicker';

describe('MetricsPicker', () => {
  it('renders metric groups and selection summary', () => {
    render(
      <MetricsPicker
        metrics={DEFAULT_METRICS_TOGGLES}
        onChange={vi.fn()}
        taskType="summarization"
      />,
    );

    expect(screen.getByText('Pick the metrics to compute')).toBeInTheDocument();
    expect(screen.getByText('Programmatic metrics')).toBeInTheDocument();
    expect(screen.getByText('LLM-as-judge metrics')).toBeInTheDocument();
    expect(screen.getByText('0 / 5 selected')).toBeInTheDocument();
  });

  it('filters metrics by task type', () => {
    render(
      <MetricsPicker
        metrics={DEFAULT_METRICS_TOGGLES}
        onChange={vi.fn()}
        taskType="classification"
      />,
    );

    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.queryByText('BLEU')).not.toBeInTheDocument();
  });

  it('toggles a single metric', () => {
    const onChange = vi.fn();

    render(
      <MetricsPicker
        metrics={DEFAULT_METRICS_TOGGLES}
        onChange={onChange}
        taskType="summarization"
      />,
    );

    fireEvent.click(document.getElementById('metric-bleu')!);

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_METRICS_TOGGLES,
      bleu: true,
    });
  });

  it('selects all metrics in a group', () => {
    const onChange = vi.fn();

    render(
      <MetricsPicker
        metrics={DEFAULT_METRICS_TOGGLES}
        onChange={onChange}
        taskType="summarization"
      />,
    );

    fireEvent.click(screen.getAllByText('Select all')[0]);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bleu: true,
        rouge: true,
        meteor: true,
        levenshtein: true,
        bertscore: true,
      }),
    );
  });

  it('clears all metrics in a group', () => {
    const onChange = vi.fn();
    const allSummarizationOn = {
      ...DEFAULT_METRICS_TOGGLES,
      bleu: true,
      rouge: true,
      meteor: true,
      levenshtein: true,
      bertscore: true,
    };

    render(
      <MetricsPicker
        metrics={allSummarizationOn}
        onChange={onChange}
        taskType="summarization"
      />,
    );

    fireEvent.click(screen.getAllByText('Clear')[0]);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bleu: false,
        rouge: false,
        meteor: false,
        levenshtein: false,
        bertscore: false,
      }),
    );
  });
});
