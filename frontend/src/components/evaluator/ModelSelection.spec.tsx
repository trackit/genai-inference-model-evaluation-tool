import '@testing-library/jest-dom';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AVAILABLE_MODELS, ModelMode } from '@/types/evaluation';

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
    expect(onChange).toHaveBeenCalledWith([
      { id: modelId, mode: ModelMode.RUNTIME },
    ]);

    onChange.mockClear();
    rerender(
      <ModelSelection
        selected={[{ id: modelId, mode: ModelMode.RUNTIME }]}
        onChange={onChange}
      />,
    );
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

    expect(onChange).toHaveBeenCalledWith([
      { id: customId, mode: ModelMode.RUNTIME },
    ]);
  });

  it('removes a custom model chip', () => {
    const onChange = vi.fn();
    const customId = 'us.amazon.nova-custom-v1:0';

    render(
      <ModelSelection
        selected={[{ id: customId, mode: ModelMode.RUNTIME }]}
        onChange={onChange}
      />,
    );

    expect(screen.getByText(customId)).toBeInTheDocument();
    const card = screen.getByText(customId).parentElement!;
    fireEvent.click(within(card).getAllByRole('button').at(-1)!);

    expect(onChange).toHaveBeenCalledWith([]);
  });
  it('switches a custom model to responses mode', () => {
    const onChange = vi.fn();
    const customId = 'openai.gpt-5.6-terra';

    render(
      <ModelSelection
        selected={[{ id: customId, mode: ModelMode.RUNTIME }]}
        onChange={onChange}
      />,
    );

    const card = screen.getByText(customId).parentElement!;
    fireEvent.click(
      within(card).getByRole('button', { name: /Mantle \(Responses\)/i }),
    );

    expect(onChange).toHaveBeenCalledWith([
      { id: customId, mode: ModelMode.RESPONSES },
    ]);
  });

  it('switches a custom model to messages mode', () => {
    const onChange = vi.fn();
    const customId = 'anthropic.claude-sonnet-5';

    render(
      <ModelSelection
        selected={[{ id: customId, mode: ModelMode.RUNTIME }]}
        onChange={onChange}
      />,
    );

    const card = screen.getByText(customId).parentElement!;
    fireEvent.click(
      within(card).getByRole('button', { name: /Mantle \(Messages\)/i }),
    );

    expect(onChange).toHaveBeenCalledWith([
      { id: customId, mode: ModelMode.MESSAGES },
    ]);
  });
});
