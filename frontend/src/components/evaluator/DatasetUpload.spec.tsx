import '@testing-library/jest-dom';

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { DEFAULT_METRICS_TOGGLES } from '@/types/evaluation';

import { DatasetUpload } from './DatasetUpload';

const mutateMock = vi.fn();
const resetMock = vi.fn();

let mutationState = {
  isPending: false,
  isSuccess: false,
  isError: false,
  data: undefined as
    | {
        dataset_id: string;
        sample_count: number;
        has_summary: boolean;
        has_class: boolean;
      }
    | undefined,
  error: null as { message: string } | null,
};

vi.mock('@/hooks/useEvaluation', () => ({
  useUploadDataset: () => ({
    mutate: mutateMock,
    reset: resetMock,
    ...mutationState,
  }),
}));

describe('DatasetUpload', () => {
  const defaultProps = {
    file: null,
    onChange: vi.fn(),
    onStartEvaluation: vi.fn(),
    onUploadSuccess: vi.fn(),
    metrics: DEFAULT_METRICS_TOGGLES,
    onMetricsChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mutationState = {
      isPending: false,
      isSuccess: false,
      isError: false,
      data: undefined,
      error: null,
    };
    mutateMock.mockImplementation(
      (
        _file: File,
        options?: {
          onSuccess?: (data: {
            dataset_id: string;
            sample_count: number;
            has_summary: boolean;
            has_class: boolean;
          }) => void;
        },
      ) => {
        options?.onSuccess?.({
          dataset_id: 'dataset-1',
          sample_count: 25,
          has_summary: true,
          has_class: false,
        });
      },
    );
  });

  it('renders upload instructions and task tabs', () => {
    renderWithProviders(<DatasetUpload {...defaultProps} />);

    expect(screen.getByText('Upload Dataset')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /summarization/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /classification/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Drop your file here or click to browse'),
    ).toBeInTheDocument();
  });

  it('switches task guidance when classification tab is selected', () => {
    renderWithProviders(<DatasetUpload {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /classification/i }));

    expect(screen.getAllByText('document').length).toBeGreaterThan(0);
    expect(screen.getAllByText('class').length).toBeGreaterThan(0);
    expect(screen.getByText(/Classification is detected/)).toBeInTheDocument();
  });

  it('uploads a selected file and shows success state', async () => {
    const onChange = vi.fn();
    const onUploadSuccess = vi.fn();
    const file = new File(['document,summary\na,b'], 'samples.csv', {
      type: 'text/csv',
    });

    mutationState = {
      isPending: false,
      isSuccess: true,
      isError: false,
      data: {
        dataset_id: 'dataset-1',
        sample_count: 25,
        has_summary: true,
        has_class: false,
      },
      error: null,
    };

    renderWithProviders(
      <DatasetUpload
        {...defaultProps}
        file={file}
        onChange={onChange}
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(file, expect.any(Object));
      expect(onChange).toHaveBeenCalledWith(file);
      expect(onUploadSuccess).toHaveBeenCalledWith({
        dataset_id: 'dataset-1',
        sample_count: 25,
        taskType: 'summarization',
      });
    });

    expect(screen.getByText('samples.csv')).toBeInTheDocument();
    expect(screen.getByText(/25 samples/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start Evaluation' }),
    ).toBeDisabled();
  });

  it('shows upload error message', () => {
    const file = new File(['bad'], 'bad.csv', { type: 'text/csv' });

    mutationState = {
      isPending: false,
      isSuccess: false,
      isError: true,
      data: undefined,
      error: { message: 'Invalid dataset format' },
    };

    renderWithProviders(<DatasetUpload {...defaultProps} file={file} />);

    expect(screen.getByText('Invalid dataset format')).toBeInTheDocument();
  });
});
