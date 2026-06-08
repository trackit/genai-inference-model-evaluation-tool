import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  createEvaluation,
  getBaseUrl,
  getEvaluationResults,
  getEvaluationStatus,
  uploadDataset,
} from './apiService';

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

  // --- uploadDataset ---

  describe('uploadDataset', () => {
    it('sends FormData via POST /datasets and returns data', async () => {
      const payload = {
        dataset_id: 'd1',
        sample_count: 42,
        has_summary: true,
        has_class: false,
      };
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: payload }),
      );

      const file = new File(['hello'], 'test.csv', { type: 'text/csv' });
      const result = await uploadDataset(file);

      expect(result).toEqual(payload);
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3000/datasets');
      expect(init.method).toBe('POST');
      expect(init.body).toBeInstanceOf(FormData);
      // Content-Type must NOT be set manually
      expect(
        (init.headers as Record<string, string> | undefined)?.['Content-Type'],
      ).toBeUndefined();
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
      await expect(uploadDataset(file)).rejects.toThrow(ApiError);
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
        models: [{ type: 'default' as const, identifier: 'claude-sonnet' }],
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
});
