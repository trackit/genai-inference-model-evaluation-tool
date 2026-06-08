import { inject, reset } from '@trackit.io/di-container';
import { tokenFakeDatasetService } from 'backend/src/services/DatasetService/FakeDatasetService';
import { describe, expect, it } from 'vitest';
import { registerTestInfrastructue } from '../../test/registerTestInfrastructure';
import { tokenDatasetUploadUseCase } from './DatasetUploadUseCase';

describe('DatasetUploadUseCase', () => {
  describe('successful uploads', () => {
    it('should process valid CSV file', async () => {
      const { useCase, datasetService } = setup();
      const content = `document
        "Question 1"
        "Question 2"
        "Question 3"
        "Question 4"
        "Question 5"
        "Question 6"
        "Question 7"
        "Question 8"
        "Question 9"
        "Question 10"`;
      const result = await useCase.execute(content, 'test.csv');
      expect(result.dataset_id).toMatch(/^[a-f0-9-]+$/);
      expect(result.sample_count).toBe(10);
      expect(datasetService.uploads).toHaveLength(1);
      expect(datasetService.uploads[0]).toMatchObject({
        content,
        fileExtension: 'csv',
        dataset: {
          samples: expect.arrayContaining([
            expect.objectContaining({ document: 'Question 1' }),
          ]),
        },
      });
    });

    it('should process valid JSONL file', async () => {
      const { useCase, datasetService } = setup();
      const content = Array.from(
        { length: 10 },
        (_, i) => `{"document":"Question ${i + 1}"}`,
      ).join('\n');

      const result = await useCase.execute(content, 'test.jsonl');

      expect(result.sample_count).toBe(10);
      expect(datasetService.uploads).toHaveLength(1);
      expect(datasetService.uploads[0]).toMatchObject({
        content,
        fileExtension: 'jsonl',
      });
    });
  });

  describe('file format validation', () => {
    it('should reject unsupported file extensions', async () => {
      const { useCase, datasetService } = setup();
      await expect(useCase.execute('some content', 'test.txt')).rejects.toThrow(
        'Invalid file format. Only CSV and JSONL files are supported',
      );
      expect(datasetService.uploads).toHaveLength(0);
    });

    it('should handle uppercase file extensions', async () => {
      const { useCase, datasetService } = setup();
      const content = `document\n${Array.from({ length: 10 }, (_, i) => `"Question ${i + 1}"`).join('\n')}`;

      const result = await useCase.execute(content, 'test.CSV');

      expect(result.sample_count).toBe(10);
      expect(datasetService.uploads[0]?.fileExtension).toBe('csv');
    });
  });

  describe('file size validation', () => {
    it('should reject files exceeding 200MB', async () => {
      const { useCase, datasetService } = setup();
      const largeContent = 'x'.repeat(201 * 1024 * 1024);

      await expect(useCase.execute(largeContent, 'test.csv')).rejects.toThrow(
        'File size exceeds maximum limit of 200MB',
      );
      expect(datasetService.uploads).toHaveLength(0);
    });

    it('should reject files smaller than minimum size', async () => {
      const { useCase, datasetService } = setup();
      await expect(useCase.execute('x', 'test.csv')).rejects.toThrow(
        'File is too small to be a valid dataset',
      );
      expect(datasetService.uploads).toHaveLength(0);
    });

    it('should accept file at reasonable size', async () => {
      const { useCase, datasetService } = setup();
      const content = `document\n${Array.from({ length: 10 }, () => '"Question"').join('\n')}`;

      const result = await useCase.execute(content, 'test.csv');

      expect(result.sample_count).toBe(10);
      expect(datasetService.uploads).toHaveLength(1);
    });
  });

  describe('dataset size validation', () => {
    it('should reject datasets with fewer than 10 samples', async () => {
      const { useCase, datasetService } = setup();
      const content = `document\n"Question 1"\n"Question 2"`;

      await expect(useCase.execute(content, 'test.csv')).rejects.toThrow(
        'Dataset must contain at least 10 samples. Found 2 samples',
      );
      expect(datasetService.uploads).toHaveLength(0);
    });

    it('should accept dataset with exactly 10 samples', async () => {
      const { useCase } = setup();
      const content = `document\n${Array.from({ length: 10 }, (_, i) => `"Question ${i + 1}"`).join('\n')}`;

      const result = await useCase.execute(content, 'test.csv');

      expect(result.sample_count).toBe(10);
    });

    it('should accept dataset with more than 10 samples', async () => {
      const { useCase } = setup();
      const content = `document\n${Array.from({ length: 15 }, (_, i) => `"Question ${i + 1}"`).join('\n')}`;

      const result = await useCase.execute(content, 'test.csv');

      expect(result.sample_count).toBe(15);
    });
  });

  describe('malicious content scanning', () => {
    it.each([
      ['script tags', '"<script>alert(1)</script>"'],
      ['javascript: protocol', '"javascript:alert(1)"'],
      ['event handlers', '"<img onerror=alert(1)>"'],
      ['iframe tags', '"<iframe src=evil.com>"'],
    ])('should reject content with %s', async (_label, payload) => {
      const { useCase, datasetService } = setup();
      const content = `document\n${Array.from({ length: 10 }, () => payload).join('\n')}`;

      await expect(useCase.execute(content, 'test.csv')).rejects.toThrow(
        'File contains potentially malicious content',
      );
      expect(datasetService.uploads).toHaveLength(0);
    });

    it('should accept safe content', async () => {
      const { useCase, datasetService } = setup();
      const content = `document\n${Array.from({ length: 10 }, (_, i) => `"What is AI question ${i + 1}?"`).join('\n')}`;

      const result = await useCase.execute(content, 'test.csv');

      expect(result.sample_count).toBe(10);
      expect(datasetService.uploads).toHaveLength(1);
    });
  });
});

const setup = () => {
  reset();
  registerTestInfrastructue();

  return {
    useCase: inject(tokenDatasetUploadUseCase),
    datasetService: inject(tokenFakeDatasetService),
  };
};
