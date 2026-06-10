import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StepIndicator } from './StepIndicator';

describe('StepIndicator', () => {
  it('renders all configuration steps', () => {
    render(<StepIndicator currentStep={0} completedSteps={[]} />);

    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('Weights')).toBeInTheDocument();
    expect(screen.getByText('Models')).toBeInTheDocument();
    expect(screen.getByText('Dataset')).toBeInTheDocument();
    expect(screen.getByText('Set metric priorities')).toBeInTheDocument();
  });

  it('shows step numbers for incomplete steps', () => {
    render(<StepIndicator currentStep={1} completedSteps={[]} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows a check icon for completed steps', () => {
    const { container } = render(
      <StepIndicator currentStep={2} completedSteps={[0, 1]} />,
    );

    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
