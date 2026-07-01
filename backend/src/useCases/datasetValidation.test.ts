import { describe, expect, it } from 'vitest';

import { Dataset } from '../models/Dataset';
import {
  extractDatasetMetadata,
  parseDatasetFileExtension,
  validateDatasetSize,
} from './datasetValidation';

describe('datasetValidation', () => {
  describe('parseDatasetFileExtension', () => {
    it.each(['dataset.csv', 'dataset.CSV', 'path/to/file.csv'])(
      'accepts csv: %s',
      (filename) => {
        expect(parseDatasetFileExtension(filename)).toBe('csv');
      },
    );

    it.each(['dataset.jsonl', 'dataset.JSONL', 'path/to/file.jsonl'])(
      'accepts jsonl: %s',
      (filename) => {
        expect(parseDatasetFileExtension(filename)).toBe('jsonl');
      },
    );

    it.each(['dataset.txt', 'dataset', 'dataset.pdf', 'readme'])(
      'rejects unsupported extension: %s',
      (filename) => {
        expect(() => parseDatasetFileExtension(filename)).toThrow(
          'Invalid file format. Only CSV and JSONL files are supported',
        );
      },
    );
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
        dataset_id: 'dataset-id',
        sample_count: 15,
        has_summary: false,
        has_class: false,
      });
    });
  });
});
