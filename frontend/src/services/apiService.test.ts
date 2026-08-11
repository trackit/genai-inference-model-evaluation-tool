import {
  clearAccessCredentials,
  setAccessCredentials,
} from '@/lib/accessCredentials';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  createEvaluation,
  getBaseUrl,
  getDatasetPreview,
  getEvaluationResults,
  getEvaluationStatus,
  getPreprocessingStatus,
  requestAccessCode,
  startPreprocessing,
  uploadDataset,
  verifyAccessCode,
} from './apiService';

const FUTURE_EXPIRES_AT = Date.now() + 60 * 60 * 1000;

// --- getBaseUrl ---

describe('getBaseUrl', () => {
  const originalEnv = import.meta.env.VITE_API_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete import.meta.env.VITE_API_URL;
    } else {
      import.meta.env.VITE_API_URL = originalEnv;
    }
  });

  it('returns VITE_API_URL when set', () => {
    import.meta.env.VITE_API_URL = 'https://my-api.example.com';
    expect(getBaseUrl()).toBe('https://my-api.example.com');
  });

  it('falls back to /api when VITE_API_URL is not set', () => {
    delete import.meta.env.VITE_API_URL;
    expect(getBaseUrl()).toBe('/api');
  });
});

// --- ApiError ---

describe('ApiError', () => {
  it('stores status, code, message, and details', () => {
    const err = new ApiError(422, 'VALIDATION', 'bad input', { field: 'name' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(422);
    expect(err.code).toBe('VALIDATION');
    expect(err.message).toBe('bad input');
    expect(err.details).toEqual({ field: 'name' });
  });

  it('works without details', () => {
    const err = new ApiError(500, 'INTERNAL', 'oops');
    expect(err.details).toBeUndefined();
  });
});

// --- Endpoint functions ---

describe('endpoint functions', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    import.meta.env.VITE_API_URL = 'http://localhost:3000';
    clearAccessCredentials();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete import.meta.env.VITE_API_URL;
  });

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  describe('requestAccessCode', () => {
    it('sends email via POST /auth/request-code', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { sent: true } }, 202),
      );

      await requestAccessCode('user@example.com');

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/auth/request-code');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
      expect(JSON.parse(init.body as string)).toEqual({
        email: 'user@example.com',
      });
    });
  });

  describe('verifyAccessCode', () => {
    it('sends email and code via POST /auth/verify-code', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            valid: true,
            expiresAt: new Date('2026-01-01T10:30:00.000Z').toISOString(),
          },
        }),
      );

      const result = await verifyAccessCode('user@example.com', '123456');

      expect(result).toEqual({
        expiresAt: new Date('2026-01-01T10:30:00.000Z').getTime(),
      });

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/auth/verify-code');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
      expect(JSON.parse(init.body as string)).toEqual({
        email: 'user@example.com',
        code: '123456',
      });
    });

    it('throws ApiError on invalid code', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'INVALID_CODE',
              message: 'Verification code is invalid or expired',
            },
          },
          403,
        ),
      );

      await expect(
        verifyAccessCode('user@example.com', '000000'),
      ).rejects.toMatchObject({
        code: 'INVALID_CODE',
        status: 403,
      });
    });
  });

  // --- uploadDataset ---

  describe('uploadDataset', () => {
    it('runs init → S3 → confirm flow and returns data', async () => {
      const payload = {
        dataset_type: 'structured',
        dataset_id: 'd1',
        sample_count: 42,
        has_summary: true,
        has_class: false,
      };
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({
            success: true,
            data: {
              dataset_id: 'd1',
              file_type: 'csv',
              uploads: [
                {
                  document_id: 'doc-1',
                  upload_url: 'https://bucket.s3.amazonaws.com',
                  fields: { key: 'value' },
                },
              ],
            },
          }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(jsonResponse({ success: true, data: payload }));

      const file = new File(['hello'], 'test.csv', { type: 'text/csv' });
      const result = await uploadDataset([file]);

      expect(result).toEqual(payload);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      const [initUrl, initInit] = mockFetch.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(initUrl).toBe('http://localhost:3000/datasets/init');
      expect(initInit.method).toBe('POST');
      expect((initInit.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
      expect(JSON.parse(initInit.body as string)).toEqual({
        files: [{ filename: 'test.csv', size_bytes: 5 }],
      });

      const [s3Url, s3Init] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(s3Url).toBe('https://bucket.s3.amazonaws.com');
      expect(s3Init.method).toBe('POST');
      expect(s3Init.body).toBeInstanceOf(FormData);

      const [confirmUrl, confirmInit] = mockFetch.mock.calls[2] as [
        string,
        RequestInit,
      ];
      expect(confirmUrl).toBe('http://localhost:3000/datasets/d1/confirm');
      expect(confirmInit.method).toBe('POST');
      expect(confirmInit.body).toBe(JSON.stringify({ file_type: 'csv' }));
    });

    it('includes access code headers when credentials are stored', async () => {
      setAccessCredentials({
        email: 'user@example.com',
        code: '123456',
        expiresAt: FUTURE_EXPIRES_AT,
      });
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({
            success: true,
            data: {
              dataset_id: 'd1',
              file_type: 'csv',
              uploads: [
                {
                  document_id: 'doc-1',
                  upload_url: 'https://bucket.s3.amazonaws.com',
                  fields: {},
                },
              ],
            },
          }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(
          jsonResponse({
            success: true,
            data: {
              dataset_type: 'structured',
              dataset_id: 'd1',
              sample_count: 10,
              has_summary: false,
              has_class: false,
            },
          }),
        );

      const file = new File(['hello'], 'test.csv', { type: 'text/csv' });
      await uploadDataset([file]);

      for (const callIndex of [0, 2]) {
        const [, init] = mockFetch.mock.calls[callIndex] as [
          string,
          RequestInit,
        ];
        expect((init.headers as Record<string, string>)['x-access-email']).toBe(
          'user@example.com',
        );
        expect((init.headers as Record<string, string>)['x-access-code']).toBe(
          '123456',
        );
      }
    });

    it('throws ApiError on non-2xx with JSON error body', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'PARSE_ERROR',
              message: 'bad csv',
              details: { row: 3 },
            },
          },
          400,
        ),
      );

      const file = new File(['bad'], 'bad.csv');
      await expect(uploadDataset([file])).rejects.toThrow(ApiError);
    });

    it('uploads multiple document files and confirms once', async () => {
      const doc1 = new File(['doc-1'], 'report.pdf', {
        type: 'application/pdf',
      });
      const doc2 = new File(['doc-2'], 'notes.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const payload = {
        dataset_type: 'documents' as const,
        dataset_id: 'd1',
        file_count: 2,
        documents: [
          {
            filename: 'report.pdf',
            file_type: 'pdf',
          },
          {
            filename: 'notes.docx',
            file_type: 'docx',
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({
            success: true,
            data: {
              dataset_id: 'd1',
              uploads: [
                {
                  document_id: 'doc-1',
                  upload_url: 'https://bucket.s3.amazonaws.com',
                  fields: { key: 'report' },
                },
                {
                  document_id: 'doc-2',
                  upload_url: 'https://bucket.s3.amazonaws.com',
                  fields: { key: 'notes' },
                },
              ],
            },
          }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(jsonResponse({ success: true, data: payload }));

      const result = await uploadDataset([doc1, doc2]);
      expect(result).toEqual(payload);
      expect(mockFetch).toHaveBeenCalledTimes(4);

      const [, firstS3Init] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect((firstS3Init.body as FormData).get('key')).toBe('report');
      expect((firstS3Init.body as FormData).get('file')).toBe(doc1);

      const [, secondS3Init] = mockFetch.mock.calls[2] as [string, RequestInit];
      expect((secondS3Init.body as FormData).get('key')).toBe('notes');
      expect((secondS3Init.body as FormData).get('file')).toBe(doc2);

      const [confirmUrl, confirmInit] = mockFetch.mock.calls[3] as [
        string,
        RequestInit,
      ];
      expect(confirmUrl).toBe('http://localhost:3000/datasets/d1/confirm');
      expect(confirmInit.body).toBe(JSON.stringify({}));
    });
  });

  // --- preprocessing ---

  describe('startPreprocessing', () => {
    it('posts task type and chunking strategy to /datasets/:id/preprocess', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          { success: true, data: { executionArn: 'arn:1', status: 'RUNNING' } },
          201,
        ),
      );

      const result = await startPreprocessing('ds1', {
        taskType: 'summarization',
        chunkingStrategy: 'SECTION',
      });

      expect(result).toEqual({ executionArn: 'arn:1', status: 'RUNNING' });
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/datasets/ds1/preprocess');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        taskType: 'summarization',
        chunkingStrategy: 'SECTION',
      });
    });
  });

  describe('getPreprocessingStatus', () => {
    it('calls GET /datasets/:id/preprocess/status with the execution arn', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { state: 'STARTING' } }),
      );

      const result = await getPreprocessingStatus('ds1', 'arn:exec:1');

      expect(result).toEqual({ state: 'STARTING' });
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'http://localhost:3000/datasets/ds1/preprocess/status?executionArn=arn%3Aexec%3A1',
      );
      expect(init.method).toBeUndefined();
    });
  });

  // --- createEvaluation ---

  describe('createEvaluation', () => {
    it('sends JSON via POST /evaluations and returns data', async () => {
      const payload = {
        evaluation_id: 'e1',
        status: 'pending' as const,
        created_at: '2024-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: payload }),
      );

      const request = {
        dataset_id: 'd1',
        models: [{ identifier: 'anthropic.claude-3-5-sonnet-20241022-v2:0' }],
        weights: { accuracy: 0.5, latency: 0.3, cost: 0.2 },
      };
      const result = await createEvaluation(request);

      expect(result).toEqual(payload);

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/evaluations');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
      expect(JSON.parse(init.body as string)).toEqual(request);
    });

    it('includes access code headers when credentials are stored', async () => {
      setAccessCredentials({
        email: 'user@example.com',
        code: '123456',
        expiresAt: FUTURE_EXPIRES_AT,
      });
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            evaluation_id: 'e1',
            status: 'pending',
            created_at: '2024-01-01T00:00:00Z',
          },
        }),
      );

      await createEvaluation({
        dataset_id: 'd1',
        models: [{ type: 'default', identifier: 'claude-sonnet' }],
        weights: { accuracy: 0.5, latency: 0.3, cost: 0.2 },
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['x-access-email']).toBe(
        'user@example.com',
      );
      expect((init.headers as Record<string, string>)['x-access-code']).toBe(
        '123456',
      );
    });
  });

  // --- getEvaluationStatus ---

  describe('getEvaluationStatus', () => {
    it('calls GET /evaluations/:id and returns data', async () => {
      const payload = { evaluation_id: 'e1', status: 'running', progress: 50 };
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: payload }),
      );

      const result = await getEvaluationStatus('e1');

      expect(result).toEqual(payload);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/evaluations/e1');
      expect(init.method).toBeUndefined(); // GET is default
    });
  });

  // --- getEvaluationResults ---

  describe('getEvaluationResults', () => {
    it('calls GET /evaluations/:id/results and returns data', async () => {
      const payload = {
        evaluation_id: 'e1',
        dataset_id: 'd1',
        models: [],
        recommendation: {
          model_identifier: 'claude-sonnet',
          weighted_score: 0.9,
          reasoning: 'best',
        },
        weights: { accuracy: 0.5, latency: 0.3, cost: 0.2 },
        completed_at: '2024-01-01T01:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: payload }),
      );

      const result = await getEvaluationResults('e1');

      expect(result).toEqual(payload);
      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe('http://localhost:3000/evaluations/e1/results');
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('throws ApiError with parsed error body on non-2xx JSON response', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          { error: { code: 'NOT_FOUND', message: 'Evaluation not found' } },
          404,
        ),
      );

      try {
        await getEvaluationStatus('missing');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        const err = e as ApiError;
        expect(err.status).toBe(404);
        expect(err.code).toBe('NOT_FOUND');
        expect(err.message).toBe('Evaluation not found');
      }
    });

    it('throws ApiError with UNKNOWN_ERROR on non-2xx non-JSON response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Internal Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );

      try {
        await getEvaluationStatus('bad');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        const err = e as ApiError;
        expect(err.status).toBe(500);
        expect(err.code).toBe('UNKNOWN_ERROR');
      }
    });

    it('throws ApiError with NETWORK_ERROR on fetch rejection', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      try {
        await getEvaluationStatus('any');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        const err = e as ApiError;
        expect(err.status).toBe(0);
        expect(err.code).toBe('NETWORK_ERROR');
        expect(err.message).toBe('Failed to fetch');
      }
    });

    it('throws ApiError with TIMEOUT on abort', async () => {
      mockFetch.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(
                new DOMException('The operation was aborted.', 'AbortError'),
              );
            });
          }),
      );

      // Use a very short timeout to trigger abort quickly
      // We need to call fetchWithTimeout directly — but it's not exported.
      // Instead, we test via uploadDataset with a patched timeout.
      // For now, verify the abort path by simulating the DOMException directly.
      mockFetch.mockReset();
      mockFetch.mockRejectedValueOnce(
        new DOMException('The operation was aborted.', 'AbortError'),
      );

      try {
        await getEvaluationStatus('timeout');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        const err = e as ApiError;
        expect(err.status).toBe(0);
        expect(err.code).toBe('TIMEOUT');
        expect(err.message).toBe('Request timed out');
      }
    });
  });

  // --- dataset preview ---
  describe('getDatasetPreview', () => {
    it('calls GET /datasets/:id/preview and returns data', async () => {
      const payload = {
        dataset_id: 'd1',
        samples: [
          { document: 'Doc 1', summary: 'Summary 1' },
          { document: 'Doc 2', class_label: 'positive' },
        ],
      };
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: payload }),
      );

      const result = await getDatasetPreview('d1');

      expect(result).toEqual(payload);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/datasets/d1/preview');
      expect(init.method).toBeUndefined();
    });

    it('includes access code headers when credentials are stored', async () => {
      setAccessCredentials({
        email: 'user@example.com',
        code: '123456',
        expiresAt: FUTURE_EXPIRES_AT,
      });
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { dataset_id: 'd1', samples: [] },
        }),
      );

      await getDatasetPreview('d1');

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['x-access-email']).toBe(
        'user@example.com',
      );
      expect((init.headers as Record<string, string>)['x-access-code']).toBe(
        '123456',
      );
    });

    it('throws ApiError when preview is not found', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          {
            error: { code: 'DATASET_NOT_FOUND', message: 'Dataset not found' },
          },
          404,
        ),
      );

      await expect(getDatasetPreview('missing')).rejects.toMatchObject({
        code: 'DATASET_NOT_FOUND',
        status: 404,
        message: 'Dataset not found',
      });
    });
  });
});
