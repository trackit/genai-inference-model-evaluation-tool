import { describe, expect, it } from 'vitest';

import { BasicError } from '../errors/BasicError';
import { Dataset } from '../models/Dataset';
import {
  extractDatasetMetadata,
  fileContentType,
  parseFileType,
  validateDatasetSize,
  validateDeclaredTotalSize,
} from './datasetValidation';

describe('datasetValidation', () => {
  describe('fileContentType', () => {
    it.each([
      ['csv', 'text/csv'],
      ['jsonl', 'application/jsonl'],
      ['pdf', 'application/pdf'],
      ['doc', 'application/msword'],
      [
        'docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    ] as const)('maps %s to %s', (fileType, contentType) => {
      expect(fileContentType(fileType)).toBe(contentType);
    });
  });

  describe('validateDeclaredTotalSize', () => {
    it('accepts totals up to the dataset limit', () => {
      expect(() =>
        validateDeclaredTotalSize([100_000_000, 50_000_000]),
      ).not.toThrow();
    });

    it('rejects totals above the dataset limit', () => {
      expect(() =>
        validateDeclaredTotalSize([150_000_000, 100_000_000]),
      ).toThrow(BasicError);
    });
  });

  describe('validateDatasetSize', () => {
    it('accepts datasets with at least 10 samples', () => {
      const dataset: Dataset = {
        samples: Array.from({ length: 10 }, (_, i) => ({
          document: `Question ${i + 1}`,
        })),
      };

      expect(() => validateDatasetSize(dataset)).not.toThrow();
    });

    it('rejects datasets with fewer than 10 samples', () => {
      const dataset: Dataset = {
        samples: [{ document: 'Question 1' }, { document: 'Question 2' }],
      };

      expect(() => validateDatasetSize(dataset)).toThrow(
        'Dataset must contain at least 10 samples. Found 2 samples',
      );
    });
  });

  describe('parseFileType', () => {
    it('rejects unsupported extensions', () => {
      expect(() => parseFileType('dataset.txt')).toThrow(
        'Invalid file format. Supported: CSV, JSONL, PDF, DOC, DOCX',
      );
    });
  });

  describe('extractDatasetMetadata', () => {
    it('sets has_summary when at least one sample has a summary', () => {
      const withSummary: Dataset = {
        samples: [
          { document: 'Q1' },
          { document: 'Q2', summary: 'A2' },
          ...Array.from({ length: 8 }, (_, i) => ({ document: `Q${i + 3}` })),
        ],
      };
      const withoutSummary: Dataset = {
        samples: Array.from({ length: 10 }, (_, i) => ({
          document: `Q${i + 1}`,
        })),
      };

      expect(extractDatasetMetadata('id', withSummary).has_summary).toBe(true);
      expect(extractDatasetMetadata('id', withoutSummary).has_summary).toBe(
        false,
      );
    });

    it('sets has_class when at least one sample has a class_label', () => {
      const withClass: Dataset = {
        samples: [
          { document: 'Q1', class_label: 'positive' },
          ...Array.from({ length: 9 }, (_, i) => ({ document: `Q${i + 2}` })),
        ],
      };
      const withoutClass: Dataset = {
        samples: Array.from({ length: 10 }, (_, i) => ({
          document: `Q${i + 1}`,
        })),
      };

      expect(extractDatasetMetadata('id', withClass).has_class).toBe(true);
      expect(extractDatasetMetadata('id', withoutClass).has_class).toBe(false);
    });

    it('sets sample_count to the number of samples', () => {
      const dataset: Dataset = {
        samples: Array.from({ length: 15 }, (_, i) => ({
          document: `Q${i + 1}`,
        })),
      };

      expect(extractDatasetMetadata('dataset-id', dataset)).toEqual({
        dataset_type: 'structured',
        dataset_id: 'dataset-id',
        sample_count: 15,
        has_summary: false,
        has_class: false,
      });
    });
  });
});
