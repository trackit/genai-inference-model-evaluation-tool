import '@testing-library/jest-dom';

import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import type { DatasetPreviewData } from '@/types/evaluation';

import { DatasetConfirm } from './DatasetConfirm';

const refetchMock = vi.fn();
const editGroundTruthMock = vi.fn();

let previewState: {
  data: DatasetPreviewData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: { message: string } | null;
} = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
};

vi.mock('@/hooks/useEvaluation', () => ({
  useDatasetPreview: () => ({
    refetch: refetchMock,
    ...previewState,
  }),
  useEditGroundTruth: () => ({
    mutateAsync: editGroundTruthMock,
    isPending: false,
    isError: false,
    error: null,
    variables: undefined,
  }),
}));

describe('DatasetConfirm', () => {
  const onConfirm = vi.fn();
  const onBack = vi.fn();

  const defaultProps = {
    datasetId: 'dataset-1',
    sampleCount: 25,
    onConfirm,
    onBack,
  };

  const previewData: DatasetPreviewData = {
    dataset_id: 'dataset-1',
    samples: [
      { document: 'Doc 1', summary: 'Summary 1' },
      { document: 'Doc 2', summary: 'Summary 2', class_label: 'positive' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    previewState = {
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    };
  });

  it('shows loading state and disables start evaluation', () => {
    previewState = { ...previewState, isLoading: true };

    renderWithProviders(<DatasetConfirm {...defaultProps} />);

    expect(screen.getByText('Loading preview…')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /start evaluation/i }),
    ).toBeDisabled();
  });

  it('shows error message and retries preview fetch', () => {
    previewState = {
      ...previewState,
      isError: true,
      error: { message: 'Dataset not found' },
    };

    renderWithProviders(<DatasetConfirm {...defaultProps} />);

    expect(screen.getByText('Dataset not found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders preview table with dynamic summary and class columns', () => {
    previewState = { ...previewState, data: previewData };

    renderWithProviders(<DatasetConfirm {...defaultProps} />);

    expect(
      screen.getByText(/Review the first 2 of 25 samples/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Document' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Summary' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Class' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Doc 1')).toBeInTheDocument();
    expect(screen.getByText('Summary 1')).toBeInTheDocument();
    expect(screen.getByText('positive')).toBeInTheDocument();
  });

  it('renders classification rows with document and class aligned', () => {
    previewState = {
      ...previewState,
      data: {
        dataset_id: 'dataset-1',
        samples: [
          {
            document: 'The market rallied on strong earnings.',
            class_label: 'positive',
          },
        ],
      },
    };

    renderWithProviders(<DatasetConfirm {...defaultProps} />);

    expect(
      screen.getByText('The market rallied on strong earnings.'),
    ).toBeInTheDocument();
    expect(screen.getByText('positive')).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Summary' }),
    ).not.toBeInTheDocument();
  });

  it('shows class in expanded row for classification datasets', () => {
    previewState = {
      ...previewState,
      data: {
        dataset_id: 'dataset-1',
        samples: [
          {
            document: 'A'.repeat(100),
            class_label: 'positive',
          },
        ],
      },
    };

    renderWithProviders(<DatasetConfirm {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /expand row 1/i }));

    expect(screen.getAllByText('positive').length).toBeGreaterThanOrEqual(2);
  });

  it('renders document-only table when samples have no summary or class', () => {
    previewState = {
      ...previewState,
      data: {
        dataset_id: 'dataset-1',
        samples: [{ document: 'Only doc' }],
      },
    };

    renderWithProviders(<DatasetConfirm {...defaultProps} />);

    expect(
      screen.getByRole('columnheader', { name: 'Document' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Summary' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Class' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Only doc')).toBeInTheDocument();
  });

  it('disables start evaluation until preview data is loaded', () => {
    renderWithProviders(<DatasetConfirm {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: /start evaluation/i }),
    ).toBeDisabled();
  });

  it('enables start evaluation and calls onConfirm when preview is loaded', () => {
    previewState = { ...previewState, data: previewData };

    renderWithProviders(<DatasetConfirm {...defaultProps} />);

    const startButton = screen.getByRole('button', {
      name: /start evaluation/i,
    });
    expect(startButton).toBeEnabled();
    fireEvent.click(startButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows starting state and disables start evaluation while launching', () => {
    previewState = { ...previewState, data: previewData };

    renderWithProviders(<DatasetConfirm {...defaultProps} isStarting />);

    expect(screen.getByText('Starting…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /starting/i })).toBeDisabled();
  });

  it('calls onBack when back is clicked', () => {
    previewState = { ...previewState, data: previewData };

    renderWithProviders(<DatasetConfirm {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('allows editing and saving ground truth when samples have ids', async () => {
    previewState = {
      ...previewState,
      data: {
        dataset_id: 'dataset-1',
        samples: [
          {
            sample_id: '550e8400-e29b-41d4-a716-446655440000',
            document: 'Doc 1',
            summary: 'Summary 1',
          },
        ],
      },
    };

    renderWithProviders(<DatasetConfirm {...defaultProps} />);

    const summaryField = screen.getByDisplayValue('Summary 1');
    fireEvent.change(summaryField, { target: { value: 'Corrected summary' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(editGroundTruthMock).toHaveBeenCalledWith({
      edits: {
        '550e8400-e29b-41d4-a716-446655440000': 'Corrected summary',
      },
    });
  });
});
