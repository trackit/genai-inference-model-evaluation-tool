import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PreprocessingStages } from './PreprocessingStages';

describe('PreprocessingStages', () => {
  it('lists every pipeline stage', () => {
    render(<PreprocessingStages stage="DOCUMENT_PARSING" />);

    expect(screen.getByText('Parsing documents')).toBeInTheDocument();
    expect(
      screen.getByText('Generating synthetic outputs'),
    ).toBeInTheDocument();
  });

  it('marks the first stage in progress and the second pending', () => {
    render(<PreprocessingStages stage="DOCUMENT_PARSING" />);

    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent(
      'Parsing documents',
    );
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('marks an earlier stage done once a later stage is running', () => {
    render(<PreprocessingStages stage="GENERATING_SYNTHETIC_OUTPUTS" />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent(
      'Generating synthetic outputs',
    );
  });

  it('marks nothing current when the stage is unknown', () => {
    render(<PreprocessingStages stage={null} />);

    expect(
      screen.queryByRole('listitem', { current: 'step' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Pending')).toHaveLength(2);
  });

  it('exposes the checklist as a live region', () => {
    render(<PreprocessingStages stage="DOCUMENT_PARSING" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
