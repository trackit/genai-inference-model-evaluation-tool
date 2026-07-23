import '@testing-library/jest-dom';

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { DatasetUpload } from './DatasetUpload';

const mutateMock = vi.fn();
const resetMock = vi.fn();

let mutationState = {
  isPending: false,
  isSuccess: false,
  isError: false,
  data: undefined as
    | {
        dataset_type: 'structured';
        dataset_id: string;
        sample_count: number;
        has_summary: boolean;
        has_class: boolean;
      }
    | {
        dataset_type: 'documents';
        dataset_id: string;
        file_count: number;
        documents: Array<{
          filename: string;
          file_type: string;
        }>;
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
    files: [],
    onChange: vi.fn(),
    onUploadSuccess: vi.fn(),
    onDocumentsConfirmed: vi.fn(),
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
        _files: File[],
        options?: {
          onSuccess?: (data: {
            dataset_type: 'structured';
            dataset_id: string;
            sample_count: number;
            has_summary: boolean;
            has_class: boolean;
          }) => void;
        },
      ) => {
        options?.onSuccess?.({
          dataset_type: 'structured',
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
      screen.getByText('Drop files here or click to browse'),
    ).toBeInTheDocument();
  });

  it('switches task guidance when classification tab is selected', () => {
    renderWithProviders(<DatasetUpload {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /classification/i }));

    expect(screen.getAllByText('document').length).toBeGreaterThan(0);
    expect(screen.getAllByText('class').length).toBeGreaterThan(0);
    expect(screen.getByText(/Classification is detected/)).toBeInTheDocument();
  });

  it('adds multiple files and removes files from the list', async () => {
    const onChange = vi.fn();
    const initialFile = new File(['one'], 'initial.pdf', {
      type: 'application/pdf',
    });
    const secondFile = new File(['two'], 'second.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const thirdFile = new File(['three'], 'third.doc', {
      type: 'application/msword',
    });

    renderWithProviders(
      <DatasetUpload
        {...defaultProps}
        files={[initialFile]}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /documents \(pdf \/ doc \/ docx\)/i }),
    );

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [secondFile, thirdFile] } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        initialFile,
        secondFile,
        thirdFile,
      ]);
      expect(resetMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('shows validation error when structured mode has multiple files', () => {
    const csvFile = new File(['a,b'], 'samples.csv', { type: 'text/csv' });
    const jsonlFile = new File(['{}'], 'samples.jsonl', {
      type: 'application/jsonl',
    });

    renderWithProviders(
      <DatasetUpload {...defaultProps} files={[csvFile, jsonlFile]} />,
    );

    expect(
      screen.getByText('Upload one CSV or JSONL file'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('clears incompatible files when switching dataset format', () => {
    const onChange = vi.fn();
    const file = new File(['a,b'], 'samples.csv', { type: 'text/csv' });

    renderWithProviders(
      <DatasetUpload {...defaultProps} files={[file]} onChange={onChange} />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /documents \(pdf \/ doc \/ docx\)/i }),
    );

    expect(onChange).toHaveBeenCalledWith([]);
    expect(resetMock).toHaveBeenCalled();
  });

  it('uploads selected files on explicit upload click', async () => {
    const onChange = vi.fn();
    const onUploadSuccess = vi.fn();
    const file = new File(['document,summary\na,b'], 'samples.csv', {
      type: 'text/csv',
    });

    renderWithProviders(
      <DatasetUpload
        {...defaultProps}
        files={[file]}
        onChange={onChange}
        onUploadSuccess={onUploadSuccess}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith([file], expect.any(Object));
      expect(onUploadSuccess).toHaveBeenCalledWith({
        dataset_type: 'structured',
        dataset_id: 'dataset-1',
        taskType: 'summarization',
        sample_count: 25,
      });
    });
  });

  it('shows document upload success summary', () => {
    const file1 = new File(['doc'], 'report.pdf', { type: 'application/pdf' });
    const file2 = new File(['doc2'], 'notes.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    mutationState = {
      isPending: false,
      isSuccess: true,
      isError: false,
      data: {
        dataset_type: 'documents',
        dataset_id: 'dataset-1',
        file_count: 2,
        documents: [],
      },
      error: null,
    };

    renderWithProviders(
      <DatasetUpload {...defaultProps} files={[file1, file2]} />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /documents \(pdf \/ doc \/ docx\)/i }),
    );

    expect(screen.getByText(/2 files uploaded/)).toBeInTheDocument();
  });

  it('reveals task type + chunking and confirms documents for preprocessing', () => {
    const onDocumentsConfirmed = vi.fn();
    const file = new File(['doc'], 'report.pdf', { type: 'application/pdf' });

    mutationState = {
      isPending: false,
      isSuccess: true,
      isError: false,
      data: {
        dataset_type: 'documents',
        dataset_id: 'dataset-1',
        file_count: 2,
        documents: [],
      },
      error: null,
    };

    renderWithProviders(
      <DatasetUpload
        {...defaultProps}
        files={[file]}
        onDocumentsConfirmed={onDocumentsConfirmed}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /documents \(pdf \/ doc \/ docx\)/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /classification/i }));
    fireEvent.click(screen.getByRole('button', { name: /whole document/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /confirm & preprocess/i }),
    );

    expect(onDocumentsConfirmed).toHaveBeenCalledWith({
      dataset_id: 'dataset-1',
      taskType: 'classification',
      chunkingStrategy: 'DOCUMENT',
      file_count: 2,
    });
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

    renderWithProviders(<DatasetUpload {...defaultProps} files={[file]} />);

    expect(screen.getByText('Invalid dataset format')).toBeInTheDocument();
  });
});
