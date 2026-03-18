import {
  APIGatewayEventRequestContext,
  APIGatewayProxyEvent,
} from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from './DatasetUpload';

vi.mock('@aws-sdk/client-s3');

describe('DatasetUpload Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATASET_BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
  });

  const createEvent = (
    body: string,
    contentType: string,
  ): APIGatewayProxyEvent => {
    return {
      body,
      headers: {
        'content-type': contentType,
      },
      multiValueHeaders: {},
      isBase64Encoded: false,
      httpMethod: 'POST',
      path: '/datasets',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as APIGatewayEventRequestContext,
      resource: '',
    };
  };

  const createMultipartBody = (filename: string, content: string): string => {
    return [
      `------WebKitFormBoundary7MA4YWxkTrZu0gW`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      `Content-Type: text/csv`,
      ``,
      content,
      `------WebKitFormBoundary7MA4YWxkTrZu0gW--`,
    ].join('\r\n');
  };

  describe('successful uploads', () => {
    it('should return 200 with dataset metadata for valid CSV', async () => {
      const csvContent = `prompt\n${Array.from({ length: 10 }, (_, i) => `"Question ${i + 1}"`).join('\n')}`;
      const body = createMultipartBody('test.csv', csvContent);
      const event = createEvent(
        body,
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('dataset_id');
      expect(response.data).toHaveProperty('sample_count');
      expect(response.data.sample_count).toBe(10);
    });

    it('should return 200 with dataset metadata for valid JSONL', async () => {
      const jsonlContent = Array.from(
        { length: 10 },
        (_, i) => `{"prompt":"Question ${i + 1}"}`,
      ).join('\n');
      const body = createMultipartBody('test.jsonl', jsonlContent);
      const event = createEvent(
        body,
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response.success).toBe(true);
      expect(response.data.sample_count).toBe(10);
    });

    it('should include CORS headers', async () => {
      const csvContent = `prompt\n${Array.from({ length: 10 }, (_, i) => `"Question ${i + 1}"`).join('\n')}`;
      const body = createMultipartBody('test.csv', csvContent);
      const event = createEvent(
        body,
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = await handler(event);

      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    });
  });

  describe('error handling', () => {
    it('should return 400 for missing prompt column', async () => {
      const csvContent = `question\n${Array.from({ length: 10 }, (_, i) => `"Question ${i + 1}"`).join('\n')}`;
      const body = createMultipartBody('test.csv', csvContent);
      const event = createEvent(
        body,
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('MISSING_PROMPT');
    });

    it('should return 400 for dataset with fewer than 10 samples', async () => {
      const csvContent = `prompt\n"Question 1"\n"Question 2"`;
      const body = createMultipartBody('test.csv', csvContent);
      const event = createEvent(
        body,
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('TOO_SMALL');
    });

    it('should return 400 for file exceeding 10MB', async () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024);
      const body = createMultipartBody('test.csv', largeContent);
      const event = createEvent(
        body,
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error.code).toBe('TOO_LARGE');
    });

    it('should return 400 for invalid file format', async () => {
      const content = 'some content';
      const body = createMultipartBody('test.txt', content);
      const event = createEvent(
        body,
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error.code).toBe('INVALID_FORMAT');
    });

    it('should return 400 for malformed CSV with row number', async () => {
      const csvContent = `prompt,context\n"Valid","Valid"\n"Invalid"`;
      const body = createMultipartBody('test.csv', csvContent);
      const event = createEvent(
        body,
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error.code).toBe('INVALID_FORMAT');
      expect(response.error.details).toHaveProperty('row');
    });

    it('should return 400 for malformed JSONL with line number', async () => {
      const jsonlContent = `{"prompt":"Valid"}\n{invalid json}`;
      const body = createMultipartBody('test.jsonl', jsonlContent);
      const event = createEvent(
        body,
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error.code).toBe('INVALID_FORMAT');
      expect(response.error.details).toHaveProperty('line');
    });

    it('should return 500 when bucket name is not configured', async () => {
      delete process.env.DATASET_BUCKET_NAME;

      const csvContent = `prompt\n"Question"`;
      const body = createMultipartBody('test.csv', csvContent);
      const event = createEvent(
        body,
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const response = JSON.parse(result.body);
      expect(response.error.code).toBe('CONFIGURATION_ERROR');
    });
  });
});
