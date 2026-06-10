import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MetricsWeights } from './MetricsWeights';

describe('MetricsWeights', () => {
  it('renders weight inputs and guidance', () => {
    render(
      <MetricsWeights
        value={{ accuracy: 50, cost: 30, latency: 20 }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Set Metric Weights')).toBeInTheDocument();
    expect(screen.getByLabelText('Accuracy weight percent')).toHaveValue('50');
    expect(screen.getByLabelText('Cost weight percent')).toHaveValue('30');
    expect(screen.getByLabelText('Latency weight percent')).toHaveValue('20');
    expect(screen.getByText('Total').closest('div')).toHaveTextContent('100%');
  });

  it('shows validation error when total is not 100%', () => {
    render(
      <MetricsWeights
        value={{ accuracy: 40, cost: 30, latency: 20 }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Total must equal exactly 100%',
    );
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('calls onChange when a weight is edited', () => {
    const onChange = vi.fn();

    render(
      <MetricsWeights
        value={{ accuracy: 50, cost: 30, latency: 20 }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Accuracy weight percent'), {
      target: { value: '60' },
    });

    expect(onChange).toHaveBeenCalledWith({
      accuracy: 60,
      cost: 30,
      latency: 20,
    });
  });

  it('rejects non-numeric input', () => {
    const onChange = vi.fn();

    render(
      <MetricsWeights
        value={{ accuracy: 50, cost: 30, latency: 20 }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Accuracy weight percent'), {
      target: { value: 'abc' },
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
