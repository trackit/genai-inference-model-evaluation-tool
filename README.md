# GenAI Inference Model Evaluation Tool

A serverless tool for benchmarking and comparing Amazon Bedrock models against custom datasets. It measures accuracy, latency, and cost, then produces a weighted recommendation for the best model for your use case.

## Overview

The tool guides users through a four-step workflow:

1. **Set metric weights** — tune how much accuracy, latency, and cost matter for your workload
2. **Select models** — choose which models to evaluate and how to call them (see [Model modes](#model-modes) below)
3. **Upload a dataset** — CSV or JSONL file containing documents and optional reference outputs (summaries or class labels)
4. **Run evaluation and review results** — track progress in real time and get a ranked recommendation with per-model metrics

## Model modes

Each model in an evaluation has a **mode** that controls which inference endpoint the engine calls:

| Mode                          | Endpoint                                 | When to use                                                                                    |
| ----------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Runtime**                   | Bedrock Converse API (`bedrock-runtime`) | Standard Bedrock models with versioned IDs (`us.anthropic.claude-*`, `us.amazon.nova-*`, etc.) |
| **Mantle (Chat Completions)** | Bedrock Mantle `/v1`                     | Most third-party Mantle models (DeepSeek, Mistral, Meta, Qwen, Kimi, …)                        |
| **Mantle (Responses)**        | Bedrock Mantle `/v1` via Responses API   | OpenAI GPT-5.x models and any model that only supports the Responses surface                   |
| **Mantle (Messages)**         | Bedrock Mantle `/anthropic/v1/messages`  | Anthropic Claude models accessed via Mantle (short IDs like `anthropic.claude-haiku-4-5`)      |

Models in the predefined list always use **Runtime** mode. The mode selector appears on the chip when you type a custom model ID — pick the right surface for your model.

> **Region note:** Anthropic Mantle models are currently only available in `us-east-1`. If your stack is deployed to another region the evaluation engine automatically routes Messages-mode calls to `us-east-1` via the `ANTHROPIC_MANTLE_REGION` environment variable (set in the task definition).

### Supported task types

| Task           | Dataset format                 | Metrics computed                                           |
| -------------- | ------------------------------ | ---------------------------------------------------------- |
| Summarization  | `document` + `summary` columns | BLEU, ROUGE, METEOR, Levenshtein, BERTScore, G-Eval        |
| Classification | `document` + `label` columns   | Accuracy, Precision, Recall, F1 (macro & weighted), G-Eval |

### Architecture

```mermaid
flowchart TD
    Browser["Browser<br/>React + Vite"]

    Browser -->|static assets| CF["CloudFront"]
    CF --> S3_static["S3<br/>static assets"]

    Browser -->|API calls| APIGW["API Gateway<br/>HTTP API"]

    APIGW --> LambdaA["Lambda · Node.js<br/>/health<br/>/datasets — upload"]
    APIGW --> LambdaB["Lambda · Node.js<br/>POST /evaluations — launch"]
    APIGW --> LambdaC["Lambda · Node.js<br/>GET /evaluations/:id — status"]
    APIGW --> LambdaD["Lambda · Node.js<br/>GET /evaluations/:id/results — results"]

    LambdaA --> S3_data["S3<br/>dataset storage"]

    LambdaB --> DDB["DynamoDB<br/>job state"]
    LambdaC --> DDB
    LambdaD --> DDB

    DDB <-->|read state / write results| Fargate["ECS Fargate · Python<br/>evaluation engine"]

    Fargate -->|load dataset| S3_data
    Fargate -->|runtime inference| Bedrock["Amazon Bedrock<br/>Converse API"]
    Fargate -->|mantle inference| Mantle["Bedrock Mantle<br/>Chat Completions · Responses · Messages"]
```

The Python evaluation engine runs as a Docker container on ECS Fargate. It loads the dataset from S3, calls Bedrock (or Bedrock Mantle) for each model, computes all metrics, and writes results back to DynamoDB. Evaluation jobs time out after 30 minutes; partial results are stored if a timeout occurs.

## Prerequisites

| Tool        | Version | Purpose                       |
| ----------- | ------- | ----------------------------- |
| Node.js     | 24+     | Backend Lambda functions      |
| pnpm        | 10+     | Package manager               |
| Python      | 3.12    | Evaluation engine (local dev) |
| AWS SAM CLI | latest  | Build and deploy              |
| Docker      | latest  | Build the Fargate image       |
| AWS CLI     | v2      | Credentials and ECR login     |

Your AWS credentials must have access to Bedrock, ECR, ECS, S3, DynamoDB, Lambda, API Gateway, CloudFront, and VPC.

## Local stack deployment

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd genai-inference-model-evaluation-tool
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
STAGE=dev
LOG_RETENTION_IN_DAYS=14
AWS_REGION=us-west-2
ACCOUNT_ID=<your-aws-account-id>
```

### 3. Add your SAM deployment profile

Add an optional section to `samconfig.toml` for your username:

```toml
[yourname.deploy.parameters]
stack_name = "genai-inference-model-evaluation-tool-yourname"
s3_prefix  = "genai-inference-model-evaluation-tool-yourname"
resolve_s3 = true
region     = "us-west-2"
capabilities = ["CAPABILITY_IAM", "CAPABILITY_AUTO_EXPAND", "CAPABILITY_NAMED_IAM"]
confirm_changeset = true
tags = "Owner=\"yourname\""
image_repository = "<account-id>.dkr.ecr.us-west-2.amazonaws.com/genai-evaluation"
```

### 4. Deploy the Fargate evaluation engine

The Python evaluation engine runs as a Docker image on ECS Fargate. Build and push it to ECR with:

```bash
bash scripts/deploy-evaluation-engine.sh
```

The script:

- Builds the image for `linux/amd64` (required by Fargate)
- Logs in to ECR using your active AWS credentials
- Tags and pushes two tags: a timestamped build ID and `latest`

`ACCOUNT_ID` is read from `.env`. `AWS_REGION` must be set in your environment (e.g. via `aws-vault exec my-profile -- bash scripts/deploy-evaluation-engine.sh`).

### 5. Deploy the CloudFormation stack

```bash
pnpm deploy:backend
```

This runs `sam build --cached` followed by `sam deploy` using the environment vars as parameters. SAM will prompt you to confirm the changeset before applying.

### 6. Configure the frontend

```bash
cp frontend/.env.example frontend/.env
```

Set the API Gateway URL printed at the end of the SAM deploy output:

```env
VITE_API_URL=https://<api-id>.execute-api.us-west-2.amazonaws.com
```

### 7. Start the frontend dev server

```bash
cd frontend
pnpm dev
```

The app is served at `http://localhost:5173`.

See [frontend/README.md](frontend/README.md) for the full frontend setup, available scripts, and testing instructions.

### Running the API locally with SAM

You can run the Lambda functions locally (they still call real AWS services):

```bash
pnpm dev   # runs: sam local start-api
```

Requests to `http://localhost:3000` are routed to the local Lambda runtime. Note that the Fargate evaluation engine cannot run locally — launch evaluations against a deployed stack.

## Testing strategy

The project uses **Vitest** for all TypeScript tests. Tests are colocated with their modules (`*.test.ts`).

### Running tests

```bash
# All tests
pnpm test

# Backend only
pnpm test:backend

# Scoped suites
pnpm test:handlers    # Lambda HTTP adapters
pnpm test:usecases    # Business logic
pnpm test:services    # AWS service integrations
```

### Test layers

| Layer     | Location                                   | What is tested                                                          |
| --------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| Handlers  | `backend/src/handlers/**/*.test.ts`        | Request parsing, response shaping, error codes                          |
| Use cases | `backend/src/useCases/**/*.test.ts`        | Business rules, orchestration logic                                     |
| Services  | `backend/src/services/**/*.test.ts`        | DynamoDB, S3, ECS adapter behaviour                                     |
| Parsers   | `backend/src/parsers/**/*.test.ts`         | CSV and JSONL parsing, including property-based tests with `fast-check` |
| Frontend  | `frontend/src/services/apiService.test.ts` | API client contract                                                     |

AWS SDK calls are mocked with Vitest's `vi.mock` so tests run without AWS credentials. Property-based tests use `fast-check` to verify parser invariants across randomly generated inputs.

### Sample datasets

Three sample files are included at the repo root for manual smoke-testing:

- `test-dataset.csv` — summarization task
- `test-dataset.jsonl` — summarization task (JSONL format)
- `test-dataset-classification.csv` — classification task

## Project structure

```
.
├── backend/
│   ├── src/
│   │   ├── handlers/          # Lambda entry points (HTTP adapters)
│   │   ├── useCases/          # Business logic
│   │   ├── services/          # AWS SDK integrations (DynamoDB, S3, ECS)
│   │   ├── parsers/           # CSV / JSONL parsing
│   │   └── models/            # TypeScript interfaces
│   └── python-eval-function/  # Fargate evaluation engine
│       ├── src/               # Python source
│       │   ├── main.py
│       │   ├── invocation_router.py   # dispatches by mode → runtime / mantle / responses / messages
│       │   ├── bedrock_client.py      # Bedrock Converse (runtime mode)
│       │   ├── openai_client.py       # Bedrock Mantle Chat Completions + Responses
│       │   ├── anthropic_client.py    # Bedrock Mantle Messages (Anthropic SDK)
│       │   ├── models.py              # shared dataclasses + logging helpers
│       │   ├── accuracy_evaluator.py
│       │   ├── classification_evaluator.py
│       │   ├── geval_evaluator.py
│       │   ├── cost_calculator.py
│       │   └── model_recommender.py
│       ├── Dockerfile
│       └── requirements.txt
├── frontend/                  # React 19 + Vite + Tailwind (see frontend/README.md)
│   └── src/
│       ├── components/evaluator/  # Step components for the evaluation workflow
│       ├── components/ui/         # Reusable UI primitives
│       ├── hooks/                 # useEvaluation orchestration hook
│       ├── pages/                 # Index (main stepper) and NotFound
│       ├── services/              # Typed API client + contract tests
│       └── types/                 # Shared TypeScript interfaces
├── infrastructure/
│   ├── api.yaml               # Lambda functions + API Gateway
│   └── network.yaml           # VPC, subnets, security groups
├── shared/                    # Shared TypeScript types
├── template.yaml              # Root SAM / CloudFormation template
├── samconfig.toml             # Per-developer deployment profiles
└── vitest.config.ts           # Test runner configuration
```

## Automated deployment (main branch)

Pushes to `main` run `.github/workflows/deploy.yml`, which:

1. Builds the SAM backend
2. Pushes the evaluation engine Docker image to ECR
3. Deploys the CloudFormation stack
4. Builds and deploys the frontend (`deploy:webui:prod`)

### Required GitHub secrets

| Secret                  | Description                     |
| ----------------------- | ------------------------------- |
| `STAGE`                 | Deployment stage (stack suffix) |
| `AWS_REGION`            | AWS region                      |
| `ACCOUNT_ID`            | AWS account ID (ECR registry)   |
| `AWS_ACCESS_KEY_ID`     | Deploy principal access key     |
| `AWS_SECRET_ACCESS_KEY` | Deploy principal secret key     |
