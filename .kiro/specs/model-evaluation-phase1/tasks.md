# Implementation Plan: Model Evaluation Phase 1

## Overview

This implementation plan breaks down the Bedrock Model Evaluation Tool into discrete coding tasks following a layered architecture pattern. The system consists of TypeScript Lambda handlers (API layer), a Python Fargate container (evaluation engine), a React frontend (UI), and SAM infrastructure definitions.

The implementation follows an incremental approach: infrastructure → backend API → evaluation engine → frontend → integration. Each task builds on previous work and includes testing sub-tasks to validate functionality early.

## Tasks

- [x] 1. Set up project structure and infrastructure foundation
  - Create SAM template with API Gateway, Lambda functions, S3 bucket, DynamoDB table, and Fargate task definition
  - Define IAM roles with least-privilege permissions for each component
  - Configure S3 bucket with server-side encryption and CORS for frontend uploads
  - Configure DynamoDB table with partition key (evaluation_id) and GSI (dataset_id-index)
  - Set up environment variables for resource ARNs and region configuration
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 1.1 Write unit tests for SAM template validation
  - Test IAM role permissions are correctly scoped
  - _Requirements: 10.2, 10.4, 10.5_


- [x] 2. Implement dataset upload handler (TypeScript Lambda)
  - [x] 2.1 Create layered architecture: handler → use case → service layer
    - Write handler function to parse multipart/form-data requests
    - Implement DatasetUploadUseCase with validation and storage orchestration
    - Implement DatasetService with S3 upload operations
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_

  - [x] 2.2 Write property test for CSV validation
    - **Property 1: CSV Validation**
    - **Validates: Requirements 1.1**

  - [ ]* 2.3 Write property test for JSONL validation
    - **Property 2: JSONL Validation**
    - **Validates: Requirements 1.2**

  - [ ]* 2.4 Write property test for dataset upload round-trip
    - **Property 3: Dataset Upload Round-Trip**
    - **Validates: Requirements 1.4**

  - [ ]* 2.5 Write property test for optional field preservation
    - **Property 4: Optional Field Preservation**
    - **Validates: Requirements 1.5, 1.6**

  - [x] 2.6 Implement CSV parser with validation
    - Parse CSV content into dataset structure
    - Validate "document" column exists
    - Preserve optional "summary" and "class" columns
    - Return descriptive errors with row numbers for malformed data
    - _Requirements: 1.1, 1.5, 1.6, 9.1, 9.4_

  - [ ]* 2.7 Write unit tests for CSV parser edge cases
    - Test missing document column
    - Test malformed CSV rows
    - Test empty optional fields
    - _Requirements: 1.1, 9.4_

  - [x] 2.8 Implement JSONL parser with validation
    - Parse JSONL content into dataset structure
    - Validate "document" field exists in each line
    - Preserve optional "summary" and "class" fields
    - Return descriptive errors with line numbers for malformed JSON
    - _Requirements: 1.2, 1.5, 1.6, 9.2, 9.5_

  - [ ]* 2.9 Write unit tests for JSONL parser edge cases
    - Test missing document field
    - Test malformed JSON lines
    - Test empty optional fields
    - _Requirements: 1.2, 9.5_

  - [x] 2.10 Implement dataset size validation
    - Reject datasets with fewer than 10 samples
    - Reject files exceeding 200MB
    - Return clear error messages for size violations
    - _Requirements: 1.3, 1.7_

  - [ ]* 2.11 Write unit tests for size validation
    - Test exactly 10 samples (boundary)
    - Test 9 samples (below minimum)
    - Test file size at 200MB boundary
    - _Requirements: 1.3, 1.7_

  - [x] 2.12 Implement malicious content scanning
    - Scan uploaded files for malicious patterns
    - Reject files containing suspicious content
    - _Requirements: 10.7_

  - [x] 2.13 Implement S3 upload with metadata
    - Generate unique dataset_id (UUID)
    - Upload file to S3 with encryption
    - Store metadata (sample_count, has_summary, has_class)
    - Return dataset metadata in response
    - _Requirements: 1.4, 10.4_

  - [ ]* 2.14 Write integration tests for S3 upload
    - Test successful upload and metadata retrieval
    - Test upload failure handling
    - _Requirements: 1.4, 10.4_

  - [x] 2.15 Implement error handling and response formatting
    - Return consistent error response format
    - Map validation errors to appropriate HTTP status codes (400)
    - Map server errors to 500 status codes
    - _Requirements: 11.1, 11.7_

  - [ ]* 2.16 Write property test for parsing error messages
    - **Property 39: Parsing Error Messages**
    - **Validates: Requirements 9.4, 9.5, 11.1**


- [x] 3. Implement evaluation launcher handler (TypeScript Lambda)
  - [x] 3.1 Create layered architecture: handler → use case → repository/service layer
    - Write handler function to parse evaluation request
    - Implement EvaluationLaunchUseCase with validation and job creation
    - Implement EvaluationJobsRepository with DynamoDB operations for job storage
    - Implement FargateService with ECS/Fargate task launch operations
    - _Requirements: 2.3, 3.1, 3.2_

  - [ ]* 3.2 Write property test for model selection validation
    - **Property 6: Model Selection Validation**
    - **Validates: Requirements 2.3**

  - [ ]* 3.3 Write property test for custom model acceptance
    - **Property 5: Custom Model Acceptance**
    - **Validates: Requirements 2.2**

  - [ ]* 3.4 Write property test for invalid model rejection
    - **Property 7: Invalid Model Rejection**
    - **Validates: Requirements 2.4**

  - [x] 3.5 Implement model configuration validation
    - Validate at least one model is selected
    - Accept default models (claude-sonnet, claude-opus, amazon-nova)
    - Return error for invalid model identifiers
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 3.6 Write unit tests for model validation
    - Test zero models selected
    - Test default model identifiers
    - Test custom endpoint IDs
    - Test invalid identifiers
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 3.7 Implement weight configuration validation and normalization
    - Accept optional weight parameters (accuracy, latency, cost)
    - Validate weights are non-negative numbers
    - Normalize weights to sum to 1.0
    - Use default weights (0.33, 0.33, 0.34) if not provided
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ]* 3.8 Write property test for weight validation
    - **Property 50: Weight Validation**
    - **Validates: Requirements 12.2**

  - [ ]* 3.9 Write property test for weight normalization
    - **Property 51: Weight Normalization**
    - **Validates: Requirements 12.3**

  - [x] 3.10 Write unit tests for weight configuration
    - Test default weights when not provided
    - Test negative weight rejection
    - Test normalization with various inputs
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 3.11 Implement evaluation job creation in DynamoDB
    - Generate unique evaluation_id (UUID)
    - Create job record with status "pending"
    - Store dataset_id, models, weights, timestamps
    - _Requirements: 3.1_

  - [ ]* 3.12 Write property test for evaluation job creation round-trip
    - **Property 8: Evaluation Job Creation Round-Trip**
    - **Validates: Requirements 3.1**

  - [x] 3.13 Implement Fargate container launch
    - Launch Fargate task with evaluation_id as parameter
    - Pass environment variables for S3 bucket, DynamoDB table, region
    - Handle launch failures gracefully
    - _Requirements: 3.2_

  - [ ]* 3.14 Write property test for Fargate container launch
    - **Property 9: Fargate Container Launch**
    - **Validates: Requirements 3.2**

  - [ ]* 3.15 Write integration tests for job creation and launch
    - Test complete flow: validate → create job → launch container
    - Test launch failure handling
    - _Requirements: 3.1, 3.2_

  - [x] 3.16 Implement error handling and response formatting
    - Return consistent error response format
    - Map validation errors to 400 status codes
    - Map server errors to 500 status codes
    - _Requirements: 11.7_

- [ ] 4. Implement status and results handlers (TypeScript Lambda)
  - [ ] 4.1 Create status handler with layered architecture
    - Write handler function to parse evaluation_id from path
    - Implement GetEvaluationStatusUseCase to retrieve job status
    - Implement GetEvaluation with DynamoDB query operations in EvaluationJobsRepository
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 4.2 Write property test for status retrieval
    - **Property 23: Status Retrieval**
    - **Validates: Requirements 6.1, 6.2**

  - [ ] 4.3 Implement status response formatting
    - Return status, progress, current_model, samples_processed, total_samples
    - Include error_message for failed jobs
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [ ]* 4.4 Write unit tests for status handler
    - Test pending, running, completed, failed, timeout statuses
    - Test progress calculation
    - Test error message inclusion
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [ ] 4.5 Create results handler with layered architecture
    - Write handler function to parse evaluation_id from path
    - _Requirements: 7.1, 7.2_

  - [ ]* 4.6 Write property test for results retrieval
    - **Property 27: Results Retrieval**
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 4.7 Write property test for non-existent job error
    - **Property 30: Non-Existent Job Error**
    - **Validates: Requirements 7.7**

  - [ ] 4.8 Implement results response formatting
    - Return all model metrics (accuracy, latency, cost)
    - Include recommendation with model_identifier, weighted_score, reasoning
    - Include configured weights
    - _Requirements: 7.2, 7.5, 7.6, 12.5_

  - [ ]* 4.9 Write unit tests for results handler
    - Test complete results with all metrics
    - Test results without accuracy metrics (no reference outputs)
    - Test non-existent job returns 404
    - _Requirements: 7.1, 7.2, 7.7_

  - [ ] 4.10 Implement error handling for both handlers
    - Return 404 for non-existent jobs
    - Return 500 for DynamoDB failures
    - Use consistent error response format
    - _Requirements: 7.7, 11.7_


- [ ] 5. Checkpoint - Backend API handlers complete
  - Ensure all Lambda handler tests pass
  - Verify API Gateway integration with handlers
  - Ask the user if questions arise

- [ ] 6. Implement Python evaluation engine core
  - [ ] 6.1 Create evaluation engine entry point
    - Write main.py with entry point that reads evaluation_id from environment
    - Load job configuration from DynamoDB
    - Orchestrate dataset loading, model evaluation, and results storage
    - Handle timeout (30 minutes) with graceful termination
    - _Requirements: 3.2, 3.9_

  - [ ] 6.2 Implement dataset loader
    - Load dataset from S3 using dataset_id from job configuration
    - Parse CSV or JSONL format based on file extension
    - Return dataset structure with documents, summaries, classes
    - _Requirements: 3.3_

  - [ ]* 6.3 Write property test for dataset loading
    - **Property 10: Dataset Loading**
    - **Validates: Requirements 3.3**

  - [ ]* 6.4 Write unit tests for dataset loader
    - Test CSV loading
    - Test JSONL loading
    - Test S3 read failures
    - _Requirements: 3.3_

  - [ ] 6.5 Implement progress tracker
    - Update DynamoDB with current status, progress percentage, current_model
    - Calculate progress as (completed_invocations / total_invocations) × 100
    - Update samples_processed count
    - _Requirements: 6.3_

  - [ ]* 6.6 Write property test for progress calculation
    - **Property 24: Progress Calculation**
    - **Validates: Requirements 6.3**

  - [ ]* 6.7 Write unit tests for progress tracker
    - Test progress calculation with various completion states
    - Test DynamoDB update operations
    - _Requirements: 6.3_

  - [ ] 6.8 Implement status transition logic
    - Transition from "pending" to "running" on start
    - Transition to "completed" on successful completion
    - Transition to "failed" on unrecoverable errors
    - Transition to "timeout" when exceeding 30 minutes
    - _Requirements: 6.4, 6.5, 3.9_

  - [ ]* 6.9 Write property test for completion status transition
    - **Property 25: Completion Status Transition**
    - **Validates: Requirements 6.4**

  - [ ]* 6.10 Write property test for failure status transition
    - **Property 26: Failure Status Transition**
    - **Validates: Requirements 6.5**

  - [ ]* 6.11 Write unit tests for status transitions
    - Test all status transition paths
    - Test timeout handling
    - _Requirements: 6.4, 6.5, 3.9_


- [ ] 7. Implement Bedrock client for model invocations
  - [ ] 7.1 Create Bedrock client with invocation tracking
    - Initialize boto3 Bedrock Runtime client
    - Implement invoke_model method that accepts model_id, document
    - Record input_tokens, output_tokens, time_to_first_token, total_latency for each invocation
    - Return InvocationResult with response text and metrics
    - _Requirements: 3.4, 3.5_

  - [ ]* 7.2 Write property test for complete model invocation
    - **Property 11: Complete Model Invocation**
    - **Validates: Requirements 3.4**

  - [ ]* 7.3 Write property test for invocation metrics capture
    - **Property 12: Invocation Metrics Capture**
    - **Validates: Requirements 3.5, 5.3, 5.5**

  - [ ] 7.4 Implement error handling for model invocations
    - Catch and log Bedrock API errors with model_id, document_id, error details
    - Return error indicator in InvocationResult
    - Continue processing on individual failures
    - _Requirements: 3.6, 11.2_

  - [ ]* 7.5 Write property test for error resilience
    - **Property 13: Error Resilience**
    - **Validates: Requirements 3.6, 11.3**

  - [ ]* 7.6 Write property test for invocation error logging
    - **Property 44: Invocation Error Logging**
    - **Validates: Requirements 11.2**

  - [ ]* 7.7 Write unit tests for Bedrock client
    - Test successful invocation with metrics
    - Test invocation failure handling
    - Test document processing
    - Mock Bedrock API responses
    - _Requirements: 3.4, 3.5, 3.6_

  - [ ] 7.8 Implement model evaluation loop
    - For each document in dataset, invoke each selected model
    - Track completed invocations for progress updates
    - Update progress after each model completes all documents
    - Collect all InvocationResults for metric calculation
    - _Requirements: 3.4_

  - [ ]* 7.9 Write integration tests for evaluation loop
    - Test loop with multiple documents and models
    - Test progress updates during execution
    - Test partial failure scenarios
    - _Requirements: 3.4, 6.3_

  - [ ] 7.10 Implement model failure threshold check
    - Count failed invocations per model
    - If >50% of invocations fail for a model, mark model evaluation as failed
    - Continue with other models
    - _Requirements: 11.4_

  - [ ]* 7.11 Write property test for model failure threshold
    - **Property 45: Model Failure Threshold**
    - **Validates: Requirements 11.4**


- [ ] 8. Implement deterministic and semantic accuracy metrics
  - [ ] 8.1 Set up fmeval dependency
    - Install fmeval library for BLEU, ROUGE, METEOR, BERTScore
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 8.2 Implement deterministic accuracy metrics
    - Calculate BLEU scores using fmeval
    - Calculate ROUGE scores using fmeval
    - Calculate METEOR scores using fmeval
    - Calculate Levenshtein similarity scores
    - Return mean score across all samples for each metric
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

  - [ ]* 8.3 Write property test for accuracy metric aggregation
    - **Property 17: Accuracy Metric Aggregation**
    - **Validates: Requirements 4.6**

  - [ ]* 8.4 Write unit tests for deterministic metrics
    - Test BLEU calculation with known examples
    - Test ROUGE calculation with known examples
    - Test METEOR calculation with known examples
    - Test Levenshtein calculation with known examples
    - Test mean aggregation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

  - [ ] 8.5 Implement semantic accuracy metrics
    - Calculate BERTScore using fmeval
    - Return mean score across all samples
    - _Requirements: 4.5, 4.6_

  - [ ]* 8.6 Write unit tests for semantic metrics
    - Test BERTScore calculation with known examples
    - Test mean aggregation
    - _Requirements: 4.5, 4.6_

  - [ ] 8.7 Implement conditional accuracy calculation
    - Check if dataset has summary or class fields
    - Skip all accuracy metrics if no reference outputs
    - Return None/null for accuracy metrics when skipped
    - _Requirements: 4.7_

  - [ ]* 8.8 Write property test for accuracy metrics conditional computation
    - **Property 18: Accuracy Metrics Conditional Computation**
    - **Validates: Requirements 4.7**

  - [ ]* 8.9 Write property test for accuracy metrics completeness
    - **Property 16: Accuracy Metrics Completeness**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

  - [ ] 8.10 Implement error handling for deterministic/semantic metric calculation
    - Log errors when metric calculation fails
    - Store partial results with failure indicator
    - Continue with remaining metrics on individual failures
    - _Requirements: 11.5_

  - [ ]* 8.11 Write property test for partial results on failure
    - **Property 46: Partial Results on Failure**
    - **Validates: Requirements 11.5**


- [ ] 9. Implement LLM-as-judge accuracy metrics (G-eval)
  - [ ] 9.1 Set up DeepEval dependency
    - Install DeepEval library for G-eval metrics
    - Configure Claude Opus as judge model for G-eval
    - _Requirements: 4.8, 4.9_

  - [ ] 9.2 Implement G-eval metrics with Claude Opus judge
    - Calculate G-eval reasoning scores using DeepEval
    - Calculate G-eval faithfulness scores using DeepEval
    - Configure Claude Opus as the judge model
    - Return mean scores across all samples
    - _Requirements: 4.8, 4.9, 4.10_

  - [ ]* 9.3 Write unit tests for G-eval metrics
    - Test G-eval reasoning calculation
    - Test G-eval faithfulness calculation
    - Verify Claude Opus is used as judge
    - Test mean aggregation
    - _Requirements: 4.8, 4.9, 4.10_

  - [ ] 9.4 Integrate G-eval with conditional accuracy calculation
    - Skip G-eval metrics if no reference outputs in dataset
    - Combine G-eval results with deterministic/semantic metrics in ModelResults
    - _Requirements: 4.11_

  - [ ]* 9.5 Write property test for G-eval conditional computation
    - **Property 47: G-eval Conditional Computation**
    - **Validates: Requirements 4.11**


- [ ] 10. Implement metric calculator for latency and cost metrics
  - [ ] 10.1 Implement tokens per second calculation
    - For each invocation, calculate TPS = output_tokens / generation_time_seconds
    - Calculate mean TPS across all invocations for each model
    - _Requirements: 5.1, 5.2_

  - [ ]* 10.2 Write property test for tokens per second calculation
    - **Property 19: Tokens Per Second Calculation**
    - **Validates: Requirements 5.1**

  - [ ]* 10.3 Write property test for latency metric aggregation
    - **Property 20: Latency Metric Aggregation**
    - **Validates: Requirements 5.2, 5.4, 5.6**

  - [ ]* 10.4 Write unit tests for TPS calculation
    - Test TPS calculation with known values
    - Test mean aggregation
    - _Requirements: 5.1, 5.2_

  - [ ] 10.5 Implement time to first token calculation
    - Extract TTFT from each invocation result
    - Calculate mean TTFT across all invocations for each model
    - _Requirements: 5.3, 5.4_

  - [ ]* 10.6 Write unit tests for TTFT calculation
    - Test TTFT extraction and aggregation
    - _Requirements: 5.3, 5.4_

  - [ ] 10.7 Implement total latency calculation
    - Extract total latency from each invocation result
    - Calculate mean total latency across all invocations for each model
    - _Requirements: 5.5, 5.6_

  - [ ]* 10.8 Write unit tests for total latency calculation
    - Test latency extraction and aggregation
    - _Requirements: 5.5, 5.6_

  - [ ] 10.9 Implement cost calculation with Bedrock pricing
    - Define pricing table for supported models (Claude Sonnet, Opus, Nova)
    - For each invocation, calculate cost = (input_tokens × input_price / 1000) + (output_tokens × output_price / 1000)
    - Calculate total cost across all invocations for each model
    - _Requirements: 5.7, 5.8, 5.9_

  - [ ]* 10.10 Write property test for cost calculation formula
    - **Property 21: Cost Calculation Formula**
    - **Validates: Requirements 5.7**

  - [ ]* 10.11 Write property test for cost aggregation
    - **Property 22: Cost Aggregation**
    - **Validates: Requirements 5.8**

  - [ ]* 10.12 Write unit tests for cost calculation
    - Test cost calculation with known pricing and token counts
    - Test total cost aggregation
    - Test pricing lookup for different models
    - _Requirements: 5.7, 5.8, 5.9_

  - [ ] 10.13 Implement complete metrics aggregation
    - Combine accuracy, latency, and cost metrics for each model
    - Return ModelResults structure with all metrics
    - Include model status (completed/failed) and error_count
    - _Requirements: 3.7_

  - [ ]* 10.14 Write property test for metrics computation completeness
    - **Property 14: Metrics Computation Completeness**
    - **Validates: Requirements 3.7**

  - [ ]* 10.15 Write integration tests for complete metric calculation
    - Test end-to-end metric calculation with sample invocation results
    - Test with and without reference outputs
    - Test with partial failures
    - _Requirements: 3.7, 4.10_


- [ ] 11. Implement model recommender
  - [ ] 11.1 Implement metric normalization
    - Normalize all metrics to 0-1 scale
    - For accuracy and TPS: higher is better (normalize directly)
    - For latency and cost: lower is better (inverse normalization)
    - Handle edge cases (all values equal, single model)
    - _Requirements: 8.4, 8.5_

  - [ ]* 11.2 Write property test for metric normalization range
    - **Property 33: Metric Normalization Range**
    - **Validates: Requirements 8.4**

  - [ ]* 11.3 Write property test for inverse normalization
    - **Property 34: Inverse Normalization**
    - **Validates: Requirements 8.5**

  - [ ]* 11.4 Write unit tests for normalization
    - Test direct normalization (accuracy, TPS)
    - Test inverse normalization (latency, cost)
    - Test edge cases (single value, all equal)
    - _Requirements: 8.4, 8.5_

  - [ ] 11.5 Implement weighted score calculation
    - For each model, calculate weighted_score = (normalized_accuracy × weight_accuracy) + (normalized_latency × weight_latency) + (normalized_cost × weight_cost)
    - Handle zero weights by excluding that dimension
    - Return weighted score for each model
    - _Requirements: 8.1, 8.2, 12.4_

  - [ ]* 11.6 Write property test for weighted score computation
    - **Property 31: Weighted Score Computation**
    - **Validates: Requirements 8.1**

  - [ ]* 11.7 Write property test for custom weights application
    - **Property 32: Custom Weights Application**
    - **Validates: Requirements 8.2**

  - [ ]* 11.8 Write property test for zero weight exclusion
    - **Property 52: Zero Weight Exclusion**
    - **Validates: Requirements 12.4**

  - [ ]* 11.9 Write unit tests for weighted score calculation
    - Test with equal weights
    - Test with custom weights
    - Test with zero weight for one dimension
    - _Requirements: 8.1, 8.2, 12.4_

  - [ ] 11.10 Implement recommendation selection
    - Select model with highest weighted score
    - Generate reasoning text explaining the recommendation
    - Return Recommendation with model_identifier, weighted_score, reasoning
    - _Requirements: 8.6_

  - [ ]* 11.11 Write property test for recommendation selection
    - **Property 35: Recommendation Selection**
    - **Validates: Requirements 8.6**

  - [ ]* 11.12 Write unit tests for recommendation
    - Test recommendation with clear winner
    - Test recommendation with close scores
    - Test reasoning text generation
    - _Requirements: 8.6_


- [ ] 12. Implement results storage and engine orchestration
  - [ ] 12.1 Implement results writer for DynamoDB
    - Store model_results array in evaluation job record
    - Store recommendation in evaluation job record
    - Update completed_at timestamp
    - Update status to "completed"
    - _Requirements: 3.8, 6.4_

  - [ ]* 12.2 Write property test for results storage round-trip
    - **Property 15: Results Storage Round-Trip**
    - **Validates: Requirements 3.8**

  - [ ]* 12.3 Write integration tests for results storage
    - Test storing complete results
    - Test storing partial results with failures
    - Test DynamoDB write failures
    - _Requirements: 3.8_

  - [ ] 12.4 Wire evaluation engine components together
    - Orchestrate: load dataset → evaluate models → calculate metrics → generate recommendation → store results
    - Update progress throughout execution
    - Handle errors at each stage gracefully
    - Ensure no orphaned code or hanging operations
    - _Requirements: 3.2, 3.3, 3.4, 3.7, 3.8_

  - [ ]* 12.5 Write integration tests for complete evaluation flow
    - Test end-to-end evaluation with sample dataset
    - Test with and without reference outputs
    - Test with model failures
    - Test timeout handling
    - _Requirements: 3.2, 3.3, 3.4, 3.7, 3.8, 3.9_

  - [ ] 12.6 Implement timeout handling
    - Monitor elapsed time during evaluation
    - If exceeding 30 minutes, terminate gracefully
    - Store partial results with "timeout" status
    - _Requirements: 3.9_

  - [ ]* 12.7 Write unit tests for timeout handling
    - Test timeout detection
    - Test partial results storage on timeout
    - _Requirements: 3.9_

- [ ] 13. Checkpoint - Evaluation engine complete
  - Ensure all Python evaluation engine tests pass
  - Verify Fargate container can be built and run locally
  - Test complete evaluation flow with mock Bedrock API
  - Ask the user if questions arise


- [ ] 14. Implement React frontend components
  - [ ] 14.1 Create dataset upload form component
    - Implement file input with drag-and-drop support
    - Show file validation feedback (format, size)
    - Display upload progress
    - Show dataset metadata after successful upload (sample_count, has_summary, has_class)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_

  - [ ]* 14.2 Write unit tests for upload form
    - Test file selection and validation
    - Test upload progress display
    - Test error message display
    - _Requirements: 1.1, 1.2, 1.3, 1.7_

  - [ ] 14.3 Create model selection component
    - Display default models (Claude Sonnet, Opus, Nova) as checkboxes
    - Provide input for custom Bedrock endpoint ID
    - Validate at least one model is selected
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 14.4 Write unit tests for model selection
    - Test default model selection
    - Test custom endpoint input
    - Test validation (zero models selected)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 14.5 Create metric weight configuration component
    - Provide sliders or number inputs for accuracy, latency, cost weights
    - Display current weight values
    - Show normalized weights (sum to 1.0)
    - Allow zero weights for dimensions user wants to ignore
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 14.6 Write unit tests for weight configuration
    - Test weight input and normalization display
    - Test zero weight handling
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ] 14.7 Create evaluation configuration wizard
    - Combine upload, model selection, and weight configuration into multi-step wizard
    - Validate each step before allowing progression
    - Submit evaluation request on final step
    - _Requirements: 1.1, 2.1, 12.1_

  - [ ]* 14.8 Write integration tests for wizard flow
    - Test complete wizard flow from upload to submission
    - Test validation at each step
    - _Requirements: 1.1, 2.1, 12.1_

  - [ ] 14.9 Create progress tracking component
    - Poll GET /evaluations/{id} every 2-3 seconds
    - Display progress bar with percentage
    - Show current status and current_model being evaluated
    - Show samples_processed / total_samples
    - Stop polling when status is "completed", "failed", or "timeout"
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 14.10 Write unit tests for progress component
    - Test polling logic
    - Test progress display updates
    - Test polling termination on completion
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 14.11 Create radar chart visualization component
    - Use charting library (recharts or similar) to render radar/hexagon chart
    - Display models across accuracy, latency, cost dimensions
    - Normalize metrics for visual comparison
    - Highlight recommended model
    - _Requirements: 7.3, 8.7_

  - [ ]* 14.12 Write unit tests for radar chart
    - Test chart rendering with sample data
    - Test recommended model highlighting
    - _Requirements: 7.3, 8.7_

  - [ ] 14.13 Create metrics table component
    - Display all metrics in tabular format
    - Show accuracy metrics (BLEU, ROUGE, METEOR, Levenshtein, BERTScore, G-eval reasoning, G-eval faithfulness) when available
    - Show latency metrics (TPS, TTFT, total latency)
    - Show cost metrics (total cost, input/output tokens)
    - Highlight recommended model row
    - Show use case type (text summarization or text classification) based on dataset fields
    - _Requirements: 7.4, 7.5, 7.6, 8.7_

  - [ ]* 14.14 Write property test for accuracy metrics display
    - **Property 28: Accuracy Metrics Display**
    - **Validates: Requirements 7.5**

  - [ ]* 14.15 Write property test for performance metrics display
    - **Property 29: Performance Metrics Display**
    - **Validates: Requirements 7.6**

  - [ ]* 14.16 Write unit tests for metrics table
    - Test table rendering with complete metrics
    - Test table rendering without accuracy metrics (no summary/class fields)
    - Test recommended model highlighting
    - _Requirements: 7.4, 7.5, 7.6_

  - [ ] 14.17 Create recommendation display component
    - Show recommended model identifier prominently
    - Display weighted score
    - Show reasoning text
    - Display configured weights used for recommendation
    - _Requirements: 8.6, 8.7, 12.5_

  - [ ]* 14.18 Write unit tests for recommendation display
    - Test recommendation rendering
    - Test weights display
    - _Requirements: 8.6, 8.7, 12.5_

  - [ ] 14.19 Create results page combining all visualization components
    - Fetch results from GET /evaluations/{id}/results
    - Display radar chart, metrics table, and recommendation
    - Handle loading and error states
    - Show error message for failed evaluations
    - _Requirements: 7.1, 7.2, 7.7_

  - [ ]* 14.20 Write integration tests for results page
    - Test complete results display
    - Test error handling for non-existent jobs
    - Test loading states
    - _Requirements: 7.1, 7.2, 7.7_

  - [ ] 14.21 Implement error handling and user feedback
    - Display user-friendly error messages for all error scenarios
    - Show validation errors inline with form fields
    - Display API errors in modal or toast notifications
    - _Requirements: 11.1, 11.6_

  - [ ]* 14.22 Write unit tests for error handling
    - Test validation error display
    - Test API error display
    - _Requirements: 11.1, 11.6_


- [ ] 15. Implement API client and state management
  - [ ] 15.1 Create TypeScript API client for frontend
    - Implement POST /datasets with multipart/form-data
    - Implement POST /evaluations with JSON payload
    - Implement GET /evaluations/{id} for status polling
    - Implement GET /evaluations/{id}/results for results retrieval
    - Handle authentication headers (IAM or Cognito tokens)
    - Parse and return typed responses
    - _Requirements: 10.1_

  - [ ]* 15.2 Write unit tests for API client
    - Test all endpoint methods
    - Test request formatting
    - Test response parsing
    - Test error handling
    - Mock fetch/axios calls
    - _Requirements: 10.1_

  - [ ] 15.3 Implement state management for evaluation workflow
    - Store dataset_id after upload
    - Store evaluation_id after submission
    - Store evaluation status and progress
    - Store evaluation results
    - Handle state transitions (uploading → configuring → evaluating → viewing results)
    - _Requirements: 1.4, 3.1, 6.1, 7.1_

  - [ ]* 15.4 Write unit tests for state management
    - Test state transitions
    - Test data persistence
    - _Requirements: 1.4, 3.1, 6.1, 7.1_

- [ ] 16. Implement security and input validation
  - [ ] 16.1 Add input validation to all API handlers
    - Validate request body schemas using JSON schema or Zod
    - Sanitize string inputs to prevent XSS
    - Validate file uploads for malicious content
    - Reject requests with invalid data types or missing required fields
    - _Requirements: 10.6, 10.7_

  - [ ]* 16.2 Write property test for input validation
    - **Property 41: Input Validation**
    - **Validates: Requirements 10.6**

  - [ ]* 16.3 Write property test for malicious content detection
    - **Property 42: Malicious Content Detection**
    - **Validates: Requirements 10.7**

  - [ ]* 16.4 Write unit tests for input validation
    - Test SQL injection patterns are rejected
    - Test XSS patterns are rejected
    - Test valid inputs are accepted
    - _Requirements: 10.6_

  - [ ] 16.5 Implement authentication and authorization
    - Configure API Gateway with IAM or Cognito authorizer
    - Validate authentication tokens in Lambda handlers
    - Return 401 for unauthenticated requests
    - _Requirements: 10.1_

  - [ ]* 16.6 Write property test for authentication enforcement
    - **Property 40: Authentication Enforcement**
    - **Validates: Requirements 10.1**

  - [ ]* 16.7 Write integration tests for authentication
    - Test authenticated requests succeed
    - Test unauthenticated requests are rejected
    - _Requirements: 10.1_

  - [ ] 16.8 Implement rate limiting
    - Configure API Gateway rate limiting
    - Return 429 status code for throttled requests
    - _Requirements: 10.8_

  - [ ]* 16.9 Write property test for rate limiting
    - **Property 43: Rate Limiting**
    - **Validates: Requirements 10.8**

  - [ ] 16.10 Implement secure error handling
    - Never expose sensitive information in error messages
    - Sanitize error details before returning to client
    - Log detailed errors server-side for debugging
    - _Requirements: 10.6_

  - [ ]* 16.11 Write property test for HTTP status code correctness
    - **Property 48: HTTP Status Code Correctness**
    - **Validates: Requirements 11.7**


- [ ] 17. Checkpoint - Security and frontend complete
  - Ensure all security tests pass
  - Verify authentication is enforced on all endpoints
  - Ensure frontend components render correctly
  - Test complete user flow in browser
  - Ask the user if questions arise

- [ ] 18. Integration and end-to-end testing
  - [ ] 18.1 Write API integration tests
    - Test complete flow: upload dataset → launch evaluation → poll status → retrieve results
    - Test error scenarios: invalid dataset, invalid models, non-existent job
    - Test with real AWS services (S3, DynamoDB, Fargate) in test environment
    - _Requirements: 1.1, 2.1, 3.1, 6.1, 7.1_

  - [ ] 18.2 Write end-to-end tests for critical user flows
    - Test complete evaluation workflow from upload to results viewing
    - Test with CSV dataset containing summary fields (text summarization use case)
    - Test with JSONL dataset containing class fields (text classification use case)
    - Test with dataset without reference outputs (no summary/class fields)
    - Test with custom model endpoint
    - Test with custom weights
    - Use Playwright or Cypress for browser automation
    - _Requirements: 1.1, 2.1, 3.1, 6.1, 7.1, 12.1_

  - [ ] 18.3 Test error handling across system boundaries
    - Test S3 upload failure handling
    - Test DynamoDB write failure handling
    - Test Bedrock API failure handling
    - Test Fargate launch failure handling
    - Verify error messages propagate correctly to frontend
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ] 18.4 Test timeout and resilience scenarios
    - Test evaluation timeout at 30-minute boundary
    - Test partial model failures (<50% threshold)
    - Test majority model failures (>50% threshold)
    - Test metric calculation failures
    - Verify partial results are stored correctly
    - _Requirements: 3.9, 11.3, 11.4, 11.5_

  - [ ] 18.5 Verify property-based test coverage
    - Ensure all correctness properties have corresponding property tests
    - Run all property tests with 100+ iterations
    - Document any properties that cannot be tested with property-based testing
    - _Requirements: All requirements_

  - [ ] 18.6 Verify test coverage meets 80% minimum
    - Run coverage reports for TypeScript Lambda handlers
    - Run coverage reports for Python evaluation engine
    - Run coverage reports for React frontend
    - Identify and test any uncovered critical paths
    - _Requirements: All requirements_


- [ ] 19. Deployment and infrastructure finalization
  - [ ] 19.1 Complete SAM template with all resources
    - Finalize API Gateway configuration with CORS and authentication
    - Finalize Lambda function configurations with appropriate memory and timeout
    - Finalize Fargate task definition with container image and resource limits
    - Finalize S3 bucket policies and encryption settings
    - Finalize DynamoDB table configuration with provisioned capacity or on-demand
    - Add CloudWatch log groups for all components
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 19.2 Create deployment scripts
    - Write script to build and push Fargate container image to ECR
    - Write script to package and deploy SAM application
    - Write script to run integration tests against deployed stack
    - Document deployment process in README
    - _Requirements: 10.1, 10.2_

  - [ ] 19.3 Configure monitoring and logging
    - Set up CloudWatch dashboards for API metrics, Lambda metrics, Fargate metrics
    - Configure CloudWatch alarms for errors, timeouts, throttling
    - Ensure all components log to CloudWatch with appropriate log levels
    - _Requirements: 11.2_

  - [ ] 19.4 Create infrastructure documentation
    - Document architecture diagram
    - Document IAM roles and permissions
    - Document environment variables and configuration
    - Document deployment process
    - Document monitoring and troubleshooting
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 20. Final checkpoint - Complete system validation
  - Deploy complete stack to test environment
  - Run all integration and E2E tests against deployed stack
  - Verify all requirements are met
  - Verify all correctness properties are validated
  - Verify 80%+ test coverage across all components
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing sub-tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests validate interactions between components
- E2E tests validate complete user workflows
- The layered architecture (handler → use case → service) ensures separation of concerns and testability
- All components follow security-first principles with input validation and least-privilege IAM permissions

## Implementation Order Rationale

1. Infrastructure first ensures all resources are available for development
2. Backend API handlers next provide the interface for frontend integration
3. Evaluation engine implements the core business logic
4. Frontend components consume the API and provide user interface
5. Security hardening ensures the system is production-ready
6. Integration testing validates the complete system
7. Deployment finalizes the infrastructure and documentation

This order minimizes dependencies and allows for incremental testing and validation at each stage.
