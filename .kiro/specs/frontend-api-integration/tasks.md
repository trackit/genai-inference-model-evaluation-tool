# Implementation Plan: Frontend API Integration

## Overview

Replace all mock data and simulated delays in the frontend with real HTTP calls to the four existing backend endpoints. Introduce an API service layer, React Query hooks for data fetching/polling, and update the model list to the three Bedrock identifiers. All changes are frontend-only.

## Tasks

- [x] 1. Update model list and frontend types
  - [x] 1.1 Replace `AVAILABLE_MODELS` in `frontend/src/types/evaluation.ts` with exactly three Bedrock entries: `claude-sonnet` (Anthropic), `claude-opus` (Anthropic), `amazon-nova` (Amazon) with appropriate display names, context windows, and cost values
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 1.2 Add backend response types and request types to `frontend/src/types/evaluation.ts`: `CreateEvaluationRequest`, `DatasetUploadData`, `EvaluationLaunchData`, `JobStatus`, `EvaluationStatusData`, `EvaluationResultsData`, `BackendModelResult`
    - These types must match the backend models in `backend/src/models/Evaluation.ts` and `backend/src/models/Dataset.ts`
    - _Requirements: 1.1, 3.4_

- [x] 2. Create API service layer
  - [x] 2.1 Create `frontend/src/services/apiService.ts` with `getBaseUrl()` reading from `VITE_API_URL` env var (fallback to `/api`), an `ApiError` class with `status`, `code`, `details` fields, and `AbortController` timeout handling (default 30s)
    - _Requirements: 1.2, 1.3, 1.5, 6.1, 6.2_
  - [x] 2.2 Implement `uploadDataset(file: File)` — sends `FormData` via `POST /datasets`, lets browser set Content-Type boundary, returns parsed `DatasetUploadData`
    - _Requirements: 1.1, 1.4, 2.1_
  - [x] 2.3 Implement `createEvaluation(request: CreateEvaluationRequest)` — sends JSON via `POST /evaluations`, returns parsed `EvaluationLaunchData`
    - _Requirements: 1.1, 1.4, 3.4_
  - [x] 2.4 Implement `getEvaluationStatus(evaluationId: string)` — calls `GET /evaluations/:id`, returns parsed `EvaluationStatusData`
    - _Requirements: 1.1, 4.1_
  - [x] 2.5 Implement `getEvaluationResults(evaluationId: string)` — calls `GET /evaluations/:id/results`, returns parsed `EvaluationResultsData`
    - _Requirements: 1.1, 5.1_

- [x] 3. Add `.env.example` entry for `VITE_API_URL`
  - Add `VITE_API_URL=http://localhost:3000` to the project `.env.example` file
  - _Requirements: 6.3_

- [x] 4. Create React Query hooks
  - [x] 4.1 Create `frontend/src/hooks/useEvaluation.ts` with `useUploadDataset` mutation hook wrapping `apiService.uploadDataset`
    - _Requirements: 2.1, 2.4_
  - [x] 4.2 Add `useCreateEvaluation` mutation hook wrapping `apiService.createEvaluation`
    - _Requirements: 3.1, 3.2_
  - [x] 4.3 Add `useEvaluationStatus(evaluationId: string | null)` query hook with `refetchInterval: 2000`, stopping when status is `completed`, `failed`, or `timeout`. Use React Query's built-in `retry: 3` for network failure handling
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 4.4 Add `useEvaluationResults(evaluationId: string | null)` query hook, enabled only when evaluationId is provided
    - _Requirements: 5.1, 5.2_

- [x] 5. Checkpoint
  - Ensure all new files compile without errors, ask the user if questions arise.

- [x] 6. Wire up DatasetUpload component
  - [x] 6.1 Refactor `frontend/src/components/evaluator/DatasetUpload.tsx` to accept an `onUploadSuccess` callback (providing `dataset_id` and `sample_count`) and an `uploadMutation` prop or use the `useUploadDataset` hook directly
    - Remove the simulated `setTimeout` validation logic
    - On file select, call `uploadDataset` mutation; use `isPending` for loading state, `data.sample_count` on success, `error.message` on failure
    - Keep file input enabled on error so user can retry with a different file
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.3, 7.2_

- [x] 7. Wire up Index page — evaluation creation and state management
  - [x] 7.1 Refactor `frontend/src/pages/Index.tsx` to store `datasetId` and `evaluationId` in state. Remove the `generateMockResults` function entirely
    - On "Start Evaluation": call `createEvaluation` with `dataset_id`, selected model identifiers (as `{ type: 'default', identifier }` objects), and weights converted from 0–100 integers to 0–1 decimals
    - On success: store `evaluationId`, transition to progress phase
    - On error: display error message, preserve config state so user can retry
    - _Requirements: 3.1, 3.2, 3.3, 7.1, 7.3, 9.1_

- [x] 8. Wire up ProgressView with real polling data
  - [x] 8.1 Refactor `frontend/src/components/evaluator/ProgressView.tsx` to accept status data props (`status`, `progress`, `samplesProcessed`, `totalSamples`, `currentModel`, `errorMessage`) instead of `totalRows`/`onComplete`
    - Remove the `useEffect` interval simulation
    - Display `progress` percentage in the progress bar, `samplesProcessed / totalSamples` as text, and `currentModel` name
    - _Requirements: 4.2, 9.2_
  - [x] 8.2 In `Index.tsx`, use `useEvaluationStatus` hook to drive `ProgressView` props. On `completed` status, transition to results phase. On `failed`/`timeout`, display `error_message` with a "New Evaluation" reset option
    - _Requirements: 4.3, 4.4, 7.1_

- [x] 9. Wire up results retrieval and display
  - [x] 9.1 Adapt `frontend/src/components/evaluator/ResultsView.tsx` to accept `EvaluationResultsData` (the backend response shape) directly instead of the current `EvaluationResult` type. Update the component to read from `data.models` (array of `BackendModelResult`) and `data.recommendation` for the recommended model and reasoning
    - _Requirements: 5.2, 5.3, 5.4_
  - [x] 9.2 In `Index.tsx`, use `useEvaluationResults` hook when status is `completed`. Pass the raw API response to `ResultsView`. On error, show error message with a "Retry" button
    - _Requirements: 5.1, 5.5, 7.4_

- [x] 10. Final checkpoint
  - Ensure all files compile without errors and the full wizard flow is wired end-to-end. Ask the user if questions arise.
