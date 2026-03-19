import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from './DatasetUpload';

vi.mock('@aws-sdk/client-s3');

describe('DatasetUpload Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATASET_BUCKET = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
  });

  const createEvent = (
    body: string,
    contentType: string,
  ): APIGatewayProxyEventV2 => ({
    version: '2.0',
    routeKey: 'POST /datasets',
    rawPath: '/datasets',
    rawQueryString: '',
    body,
    headers: { 'content-type': contentType },
    isBase64Encoded: false,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'POST',
        path: '/datasets',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-request-id',
      routeKey: 'POST /datasets',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
  });

  const createMultipartBody = (filename: string, content: string): string =>
    [
      `------WebKitFormBoundary7MA4YWxkTrZu0gW`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      `Content-Type: text/csv`,
      ``,
      content,
      `------WebKitFormBoundary7MA4YWxkTrZu0gW--`,
    ].join('\r\n');

  const asResult = (result: APIGatewayProxyResultV2) =>
    result as {
      statusCode: number;
      body: string;
      headers?: Record<string, string>;
    };

  describe('successful uploads', () => {
    it('should return 200 with dataset metadata for valid CSV', async () => {
      const csvContent = `document\n${Array.from({ length: 10 }, (_, i) => `"Document ${i + 1}"`).join('\n')}`;
      const event = createEvent(
        createMultipartBody('test.csv', csvContent),
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = asResult(await handler(event));

      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('dataset_id');
      expect(response.data.sample_count).toBe(10);
    });

    it('should return 200 with dataset metadata for valid JSONL', async () => {
      const jsonlContent = Array.from(
        { length: 10 },
        (_, i) => `{"document":"Document ${i + 1}"}`,
      ).join('\n');
      const event = createEvent(
        createMultipartBody('test.jsonl', jsonlContent),
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = asResult(await handler(event));

      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response.success).toBe(true);
      expect(response.data.sample_count).toBe(10);
    });
  });

  describe('error handling', () => {
    it('should return 400 for missing document column in CSV', async () => {
      const csvContent = `question\n${Array.from({ length: 10 }, (_, i) => `"Question ${i + 1}"`).join('\n')}`;
      const event = createEvent(
        createMultipartBody('test.csv', csvContent),
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = asResult(await handler(event));

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('MISSING_DOCUMENT');
    });

    it('should return 400 for dataset with fewer than 10 samples', async () => {
      const csvContent = `document\n"Document 1"\n"Document 2"`;
      const event = createEvent(
        createMultipartBody('test.csv', csvContent),
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = asResult(await handler(event));

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('INSUFFICIENT_SAMPLES');
    });

    it('should return 400 for invalid file format', async () => {
      const event = createEvent(
        createMultipartBody('test.txt', 'some content'),
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = asResult(await handler(event));

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error.code).toBe('INVALID_FILE_FORMAT');
    });

    it('should return 400 for malformed CSV', async () => {
      const csvContent = `document,summary\n"Valid","Valid"\n"Invalid"`;
      const event = createEvent(
        createMultipartBody('test.csv', csvContent),
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = asResult(await handler(event));

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error.code).toBe('INVALID_FORMAT');
    });

    it('should return 400 for malformed JSONL', async () => {
      const jsonlContent = `{"document":"Valid"}\n{invalid json}`;
      const event = createEvent(
        createMultipartBody('test.jsonl', jsonlContent),
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      );

      const result = asResult(await handler(event));

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error.code).toBe('INVALID_FORMAT');
    });
  });
});
