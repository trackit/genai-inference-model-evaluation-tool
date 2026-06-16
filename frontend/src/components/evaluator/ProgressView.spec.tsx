import '@testing-library/jest-dom';

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgressView } from './ProgressView';

describe('ProgressView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders queued state', () => {
    render(<ProgressView status="pending" progress={0} />);

    expect(screen.getByText('Evaluation Queued')).toBeInTheDocument();
    expect(
      screen.getByText('Your evaluation is starting soon…'),
    ).toBeInTheDocument();
  });

  it('renders in-progress state with sample counts', () => {
    render(
      <ProgressView
        status="running"
        progress={42.6}
        samplesProcessed={21}
        totalSamples={50}
        currentModel="us.amazon.nova-lite-v1:0"
      />,
    );

    expect(screen.getByText('Evaluating Models')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('43%')).toBeInTheDocument();
    expect(
      screen.getByText('Currently evaluating: us.amazon.nova-lite-v1:0'),
    ).toBeInTheDocument();
  });

  it('switches to compiling results after reaching 100%', async () => {
    render(<ProgressView status="running" progress={100} />);

    expect(screen.getByText('Evaluating Models')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Compiling Results')).toBeInTheDocument();
    expect(
      screen.getByText('All samples processed. Preparing your results…'),
    ).toBeInTheDocument();
  });

  it('shows error message when provided', () => {
    render(
      <ProgressView
        status="failed"
        progress={10}
        errorMessage="Evaluation timed out"
      />,
    );

    expect(screen.getByText('Evaluation timed out')).toBeInTheDocument();
  });
});
