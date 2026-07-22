import type { ApiError } from '@/services/apiService';
import {
  createEvaluation,
  getDatasetPreview,
  getEvaluationResults,
  getEvaluationStatus,
  uploadDataset,
} from '@/services/apiService';
import type {
  CreateEvaluationRequest,
  DatasetPreviewData,
  DatasetUploadData,
  EvaluationLaunchData,
  EvaluationResultsData,
  EvaluationStatusData,
} from '@/types/evaluation';
import { useMutation, useQuery } from '@tanstack/react-query';

export function useUploadDataset() {
  return useMutation<DatasetUploadData, ApiError, File[]>({
    mutationFn: uploadDataset,
  });
}

export function useDatasetPreview(datasetId: string | null) {
  return useQuery<DatasetPreviewData, ApiError>({
    queryKey: ['datasetPreview', datasetId],
    queryFn: () => getDatasetPreview(datasetId!),
    enabled: !!datasetId,
    staleTime: Infinity,
  });
}

export function useCreateEvaluation() {
  return useMutation<EvaluationLaunchData, ApiError, CreateEvaluationRequest>({
    mutationFn: createEvaluation,
  });
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'timeout']);

export function useEvaluationStatus(evaluationId: string | null) {
  return useQuery<EvaluationStatusData, ApiError>({
    queryKey: ['evaluationStatus', evaluationId],
    queryFn: () => getEvaluationStatus(evaluationId!),
    enabled: !!evaluationId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.has(status)) {
        return false;
      }
      return 2000;
    },
    retry: 3,
  });
}

export function useEvaluationResults(evaluationId: string | null) {
  return useQuery<EvaluationResultsData, ApiError>({
    queryKey: ['evaluationResults', evaluationId],
    queryFn: () => getEvaluationResults(evaluationId!),
    enabled: !!evaluationId,
  });
}
