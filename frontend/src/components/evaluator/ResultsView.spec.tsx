import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { summarizationResults } from '@/test/fixtures/evaluationResults';

import { ResultsView } from './ResultsView';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');

  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div data-testid="chart">{children}</div>
    ),
  };
});

describe('ResultsView', () => {
  it('renders recommendation summary and model stats', () => {
    render(<ResultsView data={summarizationResults} onReset={vi.fn()} />);

    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Nova Lite' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Best balance of accuracy and cost for this dataset.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Metric Balance')).toBeInTheDocument();
    expect(screen.getAllByTestId('chart').length).toBeGreaterThan(0);
  });

  it('calls onReset when starting a new evaluation', () => {
    const onReset = vi.fn();

    render(<ResultsView data={summarizationResults} onReset={onReset} />);

    fireEvent.click(screen.getByRole('button', { name: /new evaluation/i }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
