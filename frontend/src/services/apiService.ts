import { authHeaders, clearAccessCredentials } from '@/lib/accessCredentials';
import type {
  CreateEvaluationRequest,
  DatasetPreviewData,
  DatasetUploadData,
  EditGroundTruthData,
  EditGroundTruthRequest,
  EvaluationLaunchData,
  EvaluationResultsData,
  EvaluationStatusData,
  PreprocessingChunkingStrategy,
  PreprocessingStartData,
  PreprocessingStatusData,
  PreprocessingTaskType,
} from '@/types/evaluation';

export function getBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? '/api';
}

type InitializeDatasetUploadResponse = {
  dataset_id: string;
  file_type?: 'csv' | 'jsonl';
  uploads: Array<{
    document_id: string;
    upload_url: string;
    fields: Record<string, string>;
  }>;
};

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

async function uploadToS3(
  uploadUrl: string,
  fields: Record<string, string>,
  file: File,
): Promise<void> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  formData.append('file', file);

  const response = await fetchWithTimeout(
    uploadUrl,
    { method: 'POST', body: formData },
    300_000,
  );

  if (!response.ok) {
    throw new ApiError(
      response.status,
      'S3_UPLOAD_FAILED',
      'Failed to upload dataset to storage',
    );
  }
}

export async function uploadDataset(files: File[]): Promise<DatasetUploadData> {
  const initResponse = await fetchWithTimeout(`${getBaseUrl()}/datasets/init`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: files.map((file) => ({
        filename: file.name,
        size_bytes: file.size,
      })),
    }),
  });

  const { dataset_id, file_type, uploads } =
    await handleResponse<InitializeDatasetUploadResponse>(initResponse);

  if (uploads.length !== files.length) {
    throw new ApiError(
      500,
      'UPLOAD_PLAN_MISMATCH',
      'Upload plan does not match selected files',
    );
  }

  await Promise.all(
    uploads.map((upload, index) =>
      uploadToS3(upload.upload_url, upload.fields, files[index]),
    ),
  );

  const confirmResponse = await fetchWithTimeout(
    `${getBaseUrl()}/datasets/${dataset_id}/confirm`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ file_type }),
    },
    120_000,
  );

  return handleResponse<DatasetUploadData>(confirmResponse);
}

export async function getDatasetPreview(
  datasetId: string,
): Promise<DatasetPreviewData> {
  const response = await fetchWithTimeout(
    `${getBaseUrl()}/datasets/${datasetId}/preview`,
    { headers: authHeaders() },
  );
  return handleResponse<DatasetPreviewData>(response);
}

export async function startPreprocessing(
  datasetId: string,
  params: {
    taskType: PreprocessingTaskType;
    chunkingStrategy: PreprocessingChunkingStrategy;
  },
): Promise<PreprocessingStartData> {
  const response = await fetchWithTimeout(
    `${getBaseUrl()}/datasets/${datasetId}/preprocess`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(params),
    },
  );
  return handleResponse<PreprocessingStartData>(response);
}

export async function getPreprocessingStatus(
  datasetId: string,
  executionArn: string,
): Promise<PreprocessingStatusData> {
  const response = await fetchWithTimeout(
    `${getBaseUrl()}/datasets/${datasetId}/preprocess/status?executionArn=${encodeURIComponent(
      executionArn,
    )}`,
    { headers: authHeaders() },
  );
  return handleResponse<PreprocessingStatusData>(response);
}

export async function editGroundTruth(
  datasetId: string,
  request: EditGroundTruthRequest,
): Promise<EditGroundTruthData> {
  const response = await fetchWithTimeout(
    `${getBaseUrl()}/datasets/${datasetId}/edit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(request),
    },
  );
  return handleResponse<EditGroundTruthData>(response);
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
