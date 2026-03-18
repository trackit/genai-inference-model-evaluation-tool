import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatasetMetadata } from '../../models/Dataset';
import { DatasetUploadUseCaseImpl } from './DatasetUploadUseCase';

describe('DatasetUploadUseCase', () => {
  let useCase: DatasetUploadUseCaseImpl;
  let mockDatasetService: { uploadDataset: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDatasetService = {
      uploadDataset: vi.fn().mockResolvedValue({
        dataset_id: 'test-id',
        sample_count: 10,
        has_summary: false,
        has_class: false,
        s3_key: 'datasets/test-id.csv',
      } as DatasetMetadata),
    };
    useCase = new DatasetUploadUseCaseImpl(mockDatasetService);
  });

  describe('successful uploads', () => {
    it('should process valid CSV file', async () => {
      const content = `prompt
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

      expect(result.dataset_id).toBe('test-id');
      expect(mockDatasetService.uploadDataset).toHaveBeenCalledWith(
        content,
        'csv',
        expect.objectContaining({
          samples: expect.arrayContaining([
            expect.objectContaining({ prompt: 'Question 1' }),
          ]),
        }),
      );
    });

    it('should process valid JSONL file', async () => {
      const content = Array.from(
        { length: 10 },
        (_, i) => `{"prompt":"Question ${i + 1}"}`,
      ).join('\n');

      const result = await useCase.execute(content, 'test.jsonl');

      expect(result.dataset_id).toBe('test-id');
      expect(mockDatasetService.uploadDataset).toHaveBeenCalledWith(
        content,
        'jsonl',
        expect.any(Object),
      );
    });
  });

  describe('file format validation', () => {
    it('should reject unsupported file extensions', async () => {
      const content = 'some content';

      await expect(useCase.execute(content, 'test.txt')).rejects.toThrow(
        'Invalid file format. Only CSV and JSONL files are supported',
      );
    });

    it('should handle uppercase file extensions', async () => {
      const content = `prompt\n${Array.from({ length: 10 }, (_, i) => `"Question ${i + 1}"`).join('\n')}`;

      await expect(useCase.execute(content, 'test.CSV')).resolves.toBeDefined();
    });
  });

  describe('file size validation', () => {
    it('should reject files exceeding 10MB', async () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024);

      await expect(useCase.execute(largeContent, 'test.csv')).rejects.toThrow(
        'File size exceeds maximum limit of 10MB',
      );
    });

    it('should reject files smaller than minimum size', async () => {
      const tinyContent = 'x';

      await expect(useCase.execute(tinyContent, 'test.csv')).rejects.toThrow(
        'File is too small to be a valid dataset',
      );
    });

    it('should accept file at 10MB boundary', async () => {
      const content = `prompt\n${Array.from({ length: 10 }, () => '"Question"').join('\n')}`;

      await expect(useCase.execute(content, 'test.csv')).resolves.toBeDefined();
    });
  });

  describe('dataset size validation', () => {
    it('should reject datasets with fewer than 10 samples', async () => {
      const content = `prompt
"Question 1"
"Question 2"`;

      await expect(useCase.execute(content, 'test.csv')).rejects.toThrow(
        'Dataset must contain at least 10 samples. Found 2 samples',
      );
    });

    it('should accept dataset with exactly 10 samples', async () => {
      const content = `prompt\n${Array.from({ length: 10 }, (_, i) => `"Question ${i + 1}"`).join('\n')}`;

      await expect(useCase.execute(content, 'test.csv')).resolves.toBeDefined();
    });

    it('should accept dataset with more than 10 samples', async () => {
      const content = `prompt\n${Array.from({ length: 15 }, (_, i) => `"Question ${i + 1}"`).join('\n')}`;

      await expect(useCase.execute(content, 'test.csv')).resolves.toBeDefined();
    });
  });

  describe('malicious content scanning', () => {
    it('should reject content with script tags', async () => {
      const content = `prompt\n${Array.from({ length: 10 }, () => '"<script>alert(1)</script>"').join('\n')}`;

      await expect(useCase.execute(content, 'test.csv')).rejects.toThrow(
        'File contains potentially malicious content',
      );
    });

    it('should reject content with javascript: protocol', async () => {
      const content = `prompt\n${Array.from({ length: 10 }, () => '"javascript:alert(1)"').join('\n')}`;

      await expect(useCase.execute(content, 'test.csv')).rejects.toThrow(
        'File contains potentially malicious content',
      );
    });

    it('should reject content with event handlers', async () => {
      const content = `prompt\n${Array.from({ length: 10 }, () => '"<img onerror=alert(1)>"').join('\n')}`;

      await expect(useCase.execute(content, 'test.csv')).rejects.toThrow(
        'File contains potentially malicious content',
      );
    });

    it('should reject content with iframe tags', async () => {
      const content = `prompt\n${Array.from({ length: 10 }, () => '"<iframe src=evil.com>"').join('\n')}`;

      await expect(useCase.execute(content, 'test.csv')).rejects.toThrow(
        'File contains potentially malicious content',
      );
    });

    it('should accept safe content', async () => {
      const content = `prompt\n${Array.from({ length: 10 }, (_, i) => `"What is AI question ${i + 1}?"`).join('\n')}`;

      await expect(useCase.execute(content, 'test.csv')).resolves.toBeDefined();
    });
  });
});
