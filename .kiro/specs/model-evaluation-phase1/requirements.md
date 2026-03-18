# Requirements Document

## Introduction

This document specifies the requirements for Phase 1 of the Bedrock Model Evaluation Tool. The feature enables users to compare foundation models available through Amazon Bedrock by evaluating them across accuracy, latency, and cost metrics. Users upload datasets, configure evaluation parameters, and receive visual comparisons with model recommendations.

## Glossary

- **Dataset_Uploader**: Component that validates and stores user-provided evaluation datasets
- **Evaluation_Engine**: Fargate container that executes model inference and metric calculations
- **API_Gateway**: REST API that handles dataset uploads, evaluation requests, and result retrieval
- **Results_Visualizer**: Frontend component that displays evaluation metrics and model comparisons
- **Bedrock_Client**: Service that invokes Amazon Bedrock foundation models
- **Metric_Calculator**: Component that computes accuracy, latency, and cost metrics
- **Progress_Tracker**: Component that monitors and reports evaluation job status
- **Model_Recommender**: Component that selects the optimal model based on user preferences
- **Dataset**: Collection of documents with optional reference outputs (summary or class) in CSV or JSONL format, supporting text summarization and text classification evaluation use cases
- **Evaluation_Job**: Asynchronous process that runs model inference and metric calculations
- **Foundation_Model**: Pre-trained LLM accessible through Amazon Bedrock (Claude Sonnet, Claude Opus, Amazon Nova)

## Requirements

### Requirement 1: Dataset Upload and Validation

**User Story:** As a user, I want to upload my evaluation dataset, so that I can compare models on my specific use case.

#### Acceptance Criteria

1. WHEN a user uploads a CSV file, THE Dataset_Uploader SHALL validate that it contains a "document" column
2. WHEN a user uploads a JSONL file, THE Dataset_Uploader SHALL validate that each line contains a "document" field
3. WHEN a dataset contains fewer than 10 samples, THE Dataset_Uploader SHALL return an error message indicating minimum dataset size
4. WHEN a valid dataset is uploaded, THE Dataset_Uploader SHALL store it in S3 and return a dataset identifier
5. WHERE a dataset includes "summary" fields, THE Dataset_Uploader SHALL preserve them for accuracy evaluation in text summarization use cases
6. WHERE a dataset includes "class" fields, THE Dataset_Uploader SHALL preserve them for accuracy evaluation in text classification use cases
7. WHEN a dataset file exceeds 200MB, THE Dataset_Uploader SHALL return an error message indicating maximum file size

### Requirement 2: Model Selection and Configuration

**User Story:** As a user, I want to select which models to evaluate, so that I can compare the options relevant to my needs.

#### Acceptance Criteria

1. THE API_Gateway SHALL provide default model options including Claude Sonnet, Claude Opus, and Amazon Nova
2. WHERE a user provides a custom Bedrock model endpoint ID, THE API_Gateway SHALL accept it for evaluation
3. WHEN a user submits an evaluation request, THE API_Gateway SHALL validate that at least one model is selected
4. WHEN a user provides an invalid Bedrock model endpoint ID, THE API_Gateway SHALL return an error message indicating the invalid identifier

### Requirement 3: Evaluation Job Execution

**User Story:** As a user, I want the system to evaluate my selected models, so that I can compare their performance.

#### Acceptance Criteria

1. WHEN an evaluation request is submitted, THE API_Gateway SHALL create an Evaluation_Job and return a job identifier
2. WHEN an Evaluation_Job is created, THE API_Gateway SHALL launch the Evaluation_Engine on Fargate
3. WHEN the Evaluation_Engine starts, THE Evaluation_Engine SHALL load the dataset from S3
4. FOR EACH document in the dataset, THE Bedrock_Client SHALL invoke each selected Foundation_Model and record the response
5. FOR EACH model invocation, THE Bedrock_Client SHALL record input token count, output token count, time to first token, and total latency
6. WHEN a model invocation fails, THE Evaluation_Engine SHALL log the error and continue with remaining documents
7. WHEN all model invocations complete, THE Metric_Calculator SHALL compute accuracy, latency, and cost metrics
8. WHEN metric calculations complete, THE Evaluation_Engine SHALL store results in DynamoDB
9. WHEN an Evaluation_Job exceeds 30 minutes, THE Evaluation_Engine SHALL terminate and store partial results with a timeout status

### Requirement 4: Accuracy Metric Calculation

**User Story:** As a user, I want to measure model accuracy, so that I can select the model that produces the best outputs for my use case.

#### Acceptance Criteria

1. WHERE a dataset includes "summary" or "class" fields, THE Metric_Calculator SHALL compute BLEU scores using fmeval
2. WHERE a dataset includes "summary" or "class" fields, THE Metric_Calculator SHALL compute ROUGE scores using fmeval
3. WHERE a dataset includes "summary" or "class" fields, THE Metric_Calculator SHALL compute METEOR scores using fmeval
4. WHERE a dataset includes "summary" or "class" fields, THE Metric_Calculator SHALL compute Levenshtein similarity scores
5. WHERE a dataset includes "summary" or "class" fields, THE Metric_Calculator SHALL compute BERTScore using fmeval
6. FOR EACH deterministic and semantic accuracy metric, THE Metric_Calculator SHALL compute the mean score across all dataset samples
7. WHERE a dataset does not include "summary" or "class" fields, THE Metric_Calculator SHALL skip deterministic and semantic accuracy metrics
8. WHERE a dataset includes "summary" or "class" fields, THE Metric_Calculator SHALL compute G-eval reasoning scores using DeepEval with Claude Opus as judge
9. WHERE a dataset includes "summary" or "class" fields, THE Metric_Calculator SHALL compute G-eval faithfulness scores using DeepEval with Claude Opus as judge
10. FOR EACH G-eval metric, THE Metric_Calculator SHALL compute the mean score across all dataset samples
11. WHERE a dataset does not include "summary" or "class" fields, THE Metric_Calculator SHALL skip G-eval metrics

### Requirement 5: Performance Metric Calculation

**User Story:** As a user, I want to measure model latency and cost, so that I can select a model that meets my performance and budget requirements.

#### Acceptance Criteria

1. FOR EACH model invocation, THE Metric_Calculator SHALL compute tokens per second by dividing output tokens by generation time
2. FOR EACH model, THE Metric_Calculator SHALL compute mean tokens per second across all dataset samples
3. FOR EACH model invocation, THE Metric_Calculator SHALL record time to first token
4. FOR EACH model, THE Metric_Calculator SHALL compute mean time to first token across all dataset samples
5. FOR EACH model invocation, THE Metric_Calculator SHALL compute total latency from request start to response completion
6. FOR EACH model, THE Metric_Calculator SHALL compute mean total latency across all dataset samples
7. FOR EACH model invocation, THE Metric_Calculator SHALL compute cost by multiplying input tokens by input price and output tokens by output price
8. FOR EACH model, THE Metric_Calculator SHALL compute total cost across all dataset samples
9. THE Metric_Calculator SHALL use current Bedrock pricing for cost calculations

### Requirement 6: Progress Tracking

**User Story:** As a user, I want to monitor evaluation progress, so that I know when results will be available.

#### Acceptance Criteria

1. WHEN an evaluation status request is received, THE Progress_Tracker SHALL return the current job status
2. THE Progress_Tracker SHALL support status values: "pending", "running", "completed", "failed", "timeout"
3. WHILE an Evaluation_Job is running, THE Progress_Tracker SHALL return the percentage of completed model invocations
4. WHEN an Evaluation_Job completes, THE Progress_Tracker SHALL update the status to "completed"
5. IF an Evaluation_Job encounters an unrecoverable error, THEN THE Progress_Tracker SHALL update the status to "failed" and store an error message

### Requirement 7: Results Retrieval and Visualization

**User Story:** As a user, I want to view evaluation results in a visual format, so that I can easily compare models.

#### Acceptance Criteria

1. WHEN a results request is received for a completed Evaluation_Job, THE API_Gateway SHALL retrieve results from DynamoDB
2. THE API_Gateway SHALL return results including all computed metrics for each evaluated model
3. THE Results_Visualizer SHALL display a radar chart comparing models across accuracy, latency, and cost dimensions
4. THE Results_Visualizer SHALL display quantitative metric values for each model in a table format
5. WHERE accuracy metrics are available, THE Results_Visualizer SHALL display mean scores for BLEU, ROUGE, METEOR, Levenshtein, BERTScore
6. THE Results_Visualizer SHALL display mean tokens per second, mean time to first token, mean total latency, and total cost for each model
7. WHEN a results request is received for a non-existent job identifier, THE API_Gateway SHALL return an error message indicating the job was not found

### Requirement 8: Model Recommendation

**User Story:** As a user, I want the system to recommend the best model, so that I can make an informed selection without manual analysis.

#### Acceptance Criteria

1. WHEN evaluation results are available, THE Model_Recommender SHALL compute a weighted score for each model
2. THE Model_Recommender SHALL accept user-defined weights for accuracy, latency, and cost dimensions
3. WHERE no weights are provided, THE Model_Recommender SHALL use equal weights for all dimensions
4. FOR EACH model, THE Model_Recommender SHALL normalize metric values to a 0-1 scale before applying weights
5. THE Model_Recommender SHALL normalize latency and cost metrics inversely so that lower values produce higher scores
6. THE Model_Recommender SHALL select the model with the highest weighted score as the recommended model
7. THE Results_Visualizer SHALL highlight the recommended model in the results display

### Requirement 9: Dataset Format Parsing

**User Story:** As a developer, I want to parse CSV and JSONL datasets correctly, so that the system handles diverse input formats.

#### Acceptance Criteria

1. WHEN parsing a CSV dataset, THE Dataset_Uploader SHALL parse it into a list of row objects
2. WHEN parsing a JSONL dataset, THE Dataset_Uploader SHALL parse each line as a separate JSON object
3. FOR ALL valid datasets, parsing then formatting then parsing SHALL produce an equivalent dataset structure (round-trip property)
4. WHEN a CSV file contains malformed rows, THE Dataset_Uploader SHALL return an error message indicating the row number and parsing issue
5. WHEN a JSONL file contains malformed JSON, THE Dataset_Uploader SHALL return an error message indicating the line number and parsing issue

### Requirement 10: Infrastructure and Security

**User Story:** As a system administrator, I want secure and scalable infrastructure, so that the evaluation tool operates reliably.

#### Acceptance Criteria

1. THE API_Gateway SHALL authenticate all requests using AWS IAM or Cognito
2. THE Evaluation_Engine SHALL execute in an isolated Fargate container with minimal IAM permissions
3. THE Evaluation_Engine SHALL have IAM permissions limited to reading from the designated S3 bucket, writing to the designated DynamoDB table, and invoking Bedrock models
4. WHEN storing datasets in S3, THE Dataset_Uploader SHALL encrypt data at rest using S3 server-side encryption
5. WHEN storing results in DynamoDB, THE Evaluation_Engine SHALL encrypt data at rest using DynamoDB encryption
6. THE API_Gateway SHALL validate all input parameters to prevent injection attacks
7. WHEN a user uploads a dataset, THE Dataset_Uploader SHALL scan for malicious content before storing in S3
8. THE API_Gateway SHALL enforce rate limiting to prevent abuse

### Requirement 11: Error Handling and Resilience

**User Story:** As a user, I want clear error messages when issues occur, so that I can correct problems and retry.

#### Acceptance Criteria

1. WHEN a dataset upload fails, THE Dataset_Uploader SHALL return a descriptive error message indicating the specific validation failure
2. WHEN a Bedrock model invocation fails, THE Evaluation_Engine SHALL log the error with model identifier, document identifier, and error details
3. WHEN a Bedrock model invocation fails, THE Evaluation_Engine SHALL continue processing remaining documents and models
4. IF more than 50 percent of model invocations fail for a specific model, THEN THE Evaluation_Engine SHALL mark that model evaluation as failed
5. WHEN metric calculation fails, THE Evaluation_Engine SHALL log the error and store partial results with a failure indicator
6. WHEN an Evaluation_Job fails, THE API_Gateway SHALL return error details in the job status response
7. THE API_Gateway SHALL return HTTP status codes that accurately reflect the error type (400 for client errors, 500 for server errors)

### Requirement 12: Metric Weight Configuration

**User Story:** As a user, I want to configure how much each metric matters, so that the recommendation aligns with my priorities.

#### Acceptance Criteria

1. WHEN submitting an evaluation request, THE API_Gateway SHALL accept optional weight parameters for accuracy, latency, and cost
2. THE API_Gateway SHALL validate that weight values are non-negative numbers
3. THE API_Gateway SHALL normalize weights to sum to 1.0 before passing to the Model_Recommender
4. WHERE a user provides a weight of 0 for a dimension, THE Model_Recommender SHALL exclude that dimension from the recommendation calculation
5. THE Results_Visualizer SHALL display the configured weights alongside the recommendation
