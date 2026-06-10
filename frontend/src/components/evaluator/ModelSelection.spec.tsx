import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AVAILABLE_MODELS } from '@/types/evaluation';

import { ModelSelection } from './ModelSelection';

describe('ModelSelection', () => {
  it('renders available models', () => {
    render(<ModelSelection selected={[]} onChange={vi.fn()} />);

    expect(screen.getByText('Select Models')).toBeInTheDocument();
    expect(screen.getByText('Nova Pro')).toBeInTheDocument();
    expect(screen.getByText('Claude Opus 4.6')).toBeInTheDocument();
    expect(
      screen.getByText('0 models selected — select at least 3'),
    ).toBeInTheDocument();
  });

  it('selects and deselects a model', () => {
    const onChange = vi.fn();
    const modelId = AVAILABLE_MODELS[0].id;

    const { rerender } = render(
      <ModelSelection selected={[]} onChange={onChange} />,
    );

    fireEvent.click(screen.getByText('Nova Pro'));
    expect(onChange).toHaveBeenCalledWith([modelId]);

    onChange.mockClear();
    rerender(<ModelSelection selected={[modelId]} onChange={onChange} />);
    fireEvent.click(screen.getByText('Nova Pro'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('adds a custom model id', () => {
    const onChange = vi.fn();
    const customId = 'us.amazon.nova-custom-v1:0';

    render(<ModelSelection selected={[]} onChange={onChange} />);

    fireEvent.change(
      screen.getByPlaceholderText('e.g. us.amazon.nova-pro-v1:0'),
      { target: { value: customId } },
    );
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(onChange).toHaveBeenCalledWith([customId]);
  });

  it('removes a custom model chip', () => {
    const onChange = vi.fn();
    const customId = 'us.amazon.nova-custom-v1:0';

    render(<ModelSelection selected={[customId]} onChange={onChange} />);

    expect(screen.getByText(customId)).toBeInTheDocument();
    fireEvent.click(screen.getByText(customId).querySelector('button')!);

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
