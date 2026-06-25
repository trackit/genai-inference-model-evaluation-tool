import { authHeaders, clearAccessCredentials } from '@/lib/accessCredentials';
import type {
  CreateEvaluationRequest,
  DatasetUploadData,
  EvaluationLaunchData,
  EvaluationResultsData,
  EvaluationStatusData,
} from '@/types/evaluation';

export function getBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? '/api';
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok || response.status === 202) {
    const json = (await response.json()) as { data: T };
    return json.data;
  }

  try {
    const json = (await response.json()) as {
      error?: {
        code?: string;
        message?: string;
        details?: Record<string, unknown>;
      };
    };
    const err = json.error;
    throw new ApiError(
      response.status,
      err?.code ?? 'UNKNOWN_ERROR',
      err?.message ?? response.statusText,
      err?.details,
    );
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401) {
        clearAccessCredentials();
      }
      throw e;
    }
    throw new ApiError(response.status, 'UNKNOWN_ERROR', response.statusText);
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', 'Request timed out');
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Unknown network error',
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function requestAccessCode(email: string): Promise<void> {
  const response = await fetchWithTimeout(`${getBaseUrl()}/auth/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  await handleResponse<{ sent: boolean }>(response);
}

export async function verifyAccessCode(
  email: string,
  code: string,
): Promise<{ expiresAt: number }> {
  const response = await fetchWithTimeout(`${getBaseUrl()}/auth/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });

  const data = await handleResponse<{ valid: true; expiresAt: string }>(
    response,
  );
  return { expiresAt: Date.parse(data.expiresAt) };
}

export async function uploadDataset(file: File): Promise<DatasetUploadData> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetchWithTimeout(`${getBaseUrl()}/datasets`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  return handleResponse<DatasetUploadData>(response);
}

export async function createEvaluation(
  request: CreateEvaluationRequest,
): Promise<EvaluationLaunchData> {
  const response = await fetchWithTimeout(`${getBaseUrl()}/evaluations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(request),
  });

  return handleResponse<EvaluationLaunchData>(response);
}

export async function getEvaluationStatus(
  evaluationId: string,
): Promise<EvaluationStatusData> {
  const response = await fetchWithTimeout(
    `${getBaseUrl()}/evaluations/${evaluationId}`,
  );

  return handleResponse<EvaluationStatusData>(response);
}

export async function getEvaluationResults(
  evaluationId: string,
): Promise<EvaluationResultsData> {
  const response = await fetchWithTimeout(
    `${getBaseUrl()}/evaluations/${evaluationId}/results`,
  );

  return handleResponse<EvaluationResultsData>(response);
}
