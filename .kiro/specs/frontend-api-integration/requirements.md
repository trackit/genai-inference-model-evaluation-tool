# Requirements Document

## Introduction

This feature connects the existing React/Vite frontend to the backend REST API (API Gateway + Lambda) for the Bedrock model evaluation tool. The frontend currently uses mock data and simulated delays. This integration replaces those stubs with real HTTP calls to four endpoints: dataset upload, evaluation creation, status polling, and results retrieval. An API service layer will be introduced, and the existing wizard-style UI components will be wired to use it. No backend files will be modified as part of this feature — all changes are frontend-only.

## Glossary

- **API_Service**: A TypeScript module in the frontend that encapsulates all HTTP communication with the backend REST API.
- **DatasetUpload_Component**: The React component (`DatasetUpload.tsx`) responsible for file selection, validation feedback, and triggering dataset upload.
- **ProgressView_Component**: The React component (`ProgressView.tsx`) that displays a progress bar and status text during an evaluation run.
- **ResultsView_Component**: The React component (`ResultsView.tsx`) that renders evaluation results including charts and the recommended model.
- **Index_Page**: The main page component (`Index.tsx`) that orchestrates the wizard flow, manages evaluation config state, and transitions between config, progress, and results phases.
- **Evaluation_Job**: A backend entity representing a running or completed evaluation, identified by `evaluation_id`, with status, progress, and result fields.
- **Dataset_Upload_Response**: The JSON response from `POST /datasets` containing `dataset_id`, `sample_count`, and column metadata on success, or an error object on failure.
- **Evaluation_Launch_Response**: The JSON response from `POST /evaluations` containing `evaluation_id`, `status`, and `created_at` on success.
- **Evaluation_Status_Response**: The JSON response from `GET /evaluations/:id` containing `status`, `progress`, `current_model`, `samples_processed`, and `total_samples`.
- **Evaluation_Results_Response**: The JSON response from `GET /evaluations/:id/results` containing per-model metrics, recommendation, and weights used.
- **Polling_Interval**: The time period between consecutive `GET /evaluations/:id` requests while an evaluation is in progress.
- **ModelSelection_Component**: The React component (`ModelSelection.tsx`) that displays available models for the user to select from. Currently reads from a hardcoded `AVAILABLE_MODELS` constant with non-Bedrock model identifiers.

## Requirements

### Requirement 1: API Service Layer Creation

**User Story:** As a developer, I want a centralized API service module, so that all backend HTTP calls are managed in one place with consistent error handling and base URL configuration.

#### Acceptance Criteria

1. THE API_Service SHALL expose functions for each backend endpoint: `uploadDataset`, `createEvaluation`, `getEvaluationStatus`, and `getEvaluationResults`.
2. THE API_Service SHALL read the backend base URL from an environment variable (`VITE_API_URL`).
3. IF the API_Service receives an HTTP response with a non-2xx status code, THEN THE API_Service SHALL throw a structured error containing the status code and the error body from the response.
4. THE API_Service SHALL set the `Content-Type` header to `application/json` for JSON request bodies and omit it for file uploads.
5. THE API_Service SHALL include request timeout handling with a configurable timeout defaulting to 30 seconds.

### Requirement 2: Dataset Upload Integration

**User Story:** As a user, I want to upload my dataset file through the UI and have it sent to the backend, so that the backend can validate and store the dataset for evaluation.

#### Acceptance Criteria

1. WHEN the user selects a file in the DatasetUpload_Component, THE API_Service SHALL send the file content as the request body to `POST /datasets`.
2. WHEN the `POST /datasets` endpoint returns a successful Dataset_Upload_Response, THE DatasetUpload_Component SHALL display the `sample_count` from the response and transition to the "valid" validation state.
3. IF the `POST /datasets` endpoint returns an error response, THEN THE DatasetUpload_Component SHALL display the error message from the response body and transition to the "invalid" validation state.
4. WHILE the dataset upload request is in flight, THE DatasetUpload_Component SHALL display a loading indicator and disable the file input.
5. THE DatasetUpload_Component SHALL store the returned `dataset_id` from a successful upload so that the Index_Page can include it when creating an evaluation.

### Requirement 3: Evaluation Creation Integration

**User Story:** As a user, I want to start an evaluation after configuring my task, models, weights, and dataset, so that the backend begins processing the evaluation job.

#### Acceptance Criteria

1. WHEN the user clicks "Start Evaluation" in the DatasetUpload_Component, THE Index_Page SHALL call `API_Service.createEvaluation` with the `dataset_id`, selected model identifiers, task type, and metric weights.
2. WHEN the `POST /evaluations` endpoint returns a successful Evaluation_Launch_Response, THE Index_Page SHALL store the `evaluation_id` and transition to the progress phase.
3. IF the `POST /evaluations` endpoint returns an error response, THEN THE Index_Page SHALL display the error message to the user and remain on the dataset step.
4. THE API_Service SHALL send the evaluation request body matching the backend `EvaluationRequest` schema: `dataset_id` (string), `models` (array of `ModelConfig`), and `weights` (object with `accuracy`, `latency`, `cost` numbers).

### Requirement 4: Evaluation Status Polling

**User Story:** As a user, I want to see real-time progress of my evaluation, so that I know how far along the processing is and which model is currently being evaluated.

#### Acceptance Criteria

1. WHEN the Index_Page transitions to the progress phase, THE Index_Page SHALL begin polling `API_Service.getEvaluationStatus` using the stored `evaluation_id` at a Polling_Interval of 2 seconds.
2. WHILE the Evaluation_Status_Response `status` field is `pending` or `running`, THE ProgressView_Component SHALL update the progress bar using the `progress` percentage, display `samples_processed` out of `total_samples`, and show the `current_model` name.
3. WHEN the Evaluation_Status_Response `status` field changes to `completed`, THE Index_Page SHALL stop polling and transition to the results phase.
4. IF the Evaluation_Status_Response `status` field changes to `failed` or `timeout`, THEN THE Index_Page SHALL stop polling and display the `error_message` from the response to the user.
5. IF a polling request fails due to a network error, THEN THE Index_Page SHALL retry up to 3 consecutive times before displaying a connection error to the user.

### Requirement 5: Evaluation Results Retrieval

**User Story:** As a user, I want to see the evaluation results with model comparisons and a recommendation, so that I can choose the best model for my use case.

#### Acceptance Criteria

1. WHEN the evaluation status changes to `completed`, THE Index_Page SHALL call `API_Service.getEvaluationResults` with the `evaluation_id`.
2. WHEN the `GET /evaluations/:id/results` endpoint returns a successful Evaluation_Results_Response, THE Index_Page SHALL transform the response data into the `EvaluationResult` type expected by the ResultsView_Component.
3. THE ResultsView_Component SHALL display per-model accuracy, latency, and cost metrics from the Evaluation_Results_Response `models` array.
4. THE ResultsView_Component SHALL display the recommended model name and reasoning from the Evaluation_Results_Response `recommendation` object.
5. IF the `GET /evaluations/:id/results` endpoint returns an error response, THEN THE Index_Page SHALL display the error message and provide a "Retry" option to re-fetch results.

### Requirement 6: Environment Configuration

**User Story:** As a developer, I want the API base URL to be configurable per environment, so that the frontend can target different backend deployments without code changes.

#### Acceptance Criteria

1. THE API_Service SHALL use the `VITE_API_URL` environment variable as the base URL prefix for all API requests.
2. IF the `VITE_API_URL` environment variable is not set, THEN THE API_Service SHALL fall back to `/api` as the default base URL.
3. THE project SHALL include a `.env.example` entry documenting the `VITE_API_URL` variable.

### Requirement 7: Error State Management

**User Story:** As a user, I want clear error feedback when something goes wrong during any API interaction, so that I understand what happened and can take corrective action.

#### Acceptance Criteria

1. IF any API call fails, THEN THE Index_Page SHALL display an error message that includes the specific failure reason from the API response.
2. WHEN an error is displayed after a dataset upload failure, THE DatasetUpload_Component SHALL allow the user to select and upload a different file.
3. WHEN an error is displayed after an evaluation creation failure, THE Index_Page SHALL allow the user to retry starting the evaluation without re-entering configuration.
4. WHEN an error is displayed after a results retrieval failure, THE Index_Page SHALL provide a "Retry" button that re-fetches the results.

### Requirement 8: Update Model List to Bedrock Identifiers

**User Story:** As a user, I want the model selection list to show the correct Amazon Bedrock models, so that the evaluation runs against the actual supported models.

#### Acceptance Criteria

1. THE `AVAILABLE_MODELS` constant in `evaluation.ts` SHALL be replaced with exactly three entries using the identifiers `claude-sonnet`, `claude-opus`, and `amazon-nova`.
2. THE `AVAILABLE_MODELS` entries SHALL use these Bedrock identifiers as the `id` field and display appropriate provider names (Anthropic for Claude models, Amazon for Nova).
3. THE ModelSelection_Component SHALL continue to read from the `AVAILABLE_MODELS` constant without any API call or backend change for the model list.

### Requirement 9: Replace Mock Data with API Responses

**User Story:** As a developer, I want to remove all mock/simulated data from the frontend, so that the UI reflects real backend data exclusively.

#### Acceptance Criteria

1. THE Index_Page SHALL remove the `generateMockResults` function and use real API responses to populate the ResultsView_Component.
2. THE ProgressView_Component SHALL remove the simulated progress interval and use real polling data from `GET /evaluations/:id` to update the progress bar.
3. THE DatasetUpload_Component SHALL remove the simulated validation timeout and use the real `POST /datasets` response for validation state.
4. THE ModelSelection_Component SHALL use the updated `AVAILABLE_MODELS` constant with Bedrock model identifiers instead of the previous non-Bedrock entries.
