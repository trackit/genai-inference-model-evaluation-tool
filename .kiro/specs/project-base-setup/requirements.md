# Requirements Document

## Introduction

This feature establishes the foundational monorepo structure for the Bedrock Model Evaluation Tool. The project uses a pnpm workspace with two primary workspaces (frontend and backend), AWS SAM for infrastructure-as-code, and includes a Python Lambda for running evaluation tools (deepeval, fmeval). The Python Lambda is a standalone function invoked directly by the TypeScript Lambda handlers via the AWS SDK — it is not exposed through API Gateway. The goal is to provide a solid, deployable skeleton that all subsequent features build upon.

## Glossary

- **Monorepo**: A single repository containing multiple workspaces (frontend, backend, infra) managed by pnpm
- **Frontend_App**: A React single-page application scaffolded with the Vite CLI, deployed as a static site via CloudFront and S3
- **Backend_API**: An API Gateway (HTTP API) backed by TypeScript Lambda functions
- **Python_Lambda**: A standalone AWS Lambda function using a Python runtime to execute deepeval and fmeval evaluation tools, invoked directly by Backend_API handlers via the AWS SDK (not exposed via API Gateway)
- **SAM_Template**: The AWS SAM infrastructure-as-code configuration defined in `template.yaml` at the repository root, using CloudFormation syntax with SAM extensions
- **Workspace**: A pnpm workspace representing an isolated package within the monorepo (frontend, backend)
- **Static_Site**: A CloudFront distribution backed by an S3 bucket that serves the built Frontend_App as a static website
- **CloudFormation_Output**: AWS CloudFormation stack outputs used to pass resource references (e.g., API URL, Lambda function name) between resources and to consuming applications via environment variables
- **Vitest_Config**: The root-level Vitest test runner configuration using vite-tsconfig-paths for path resolution

## Requirements

### Requirement 1: pnpm Monorepo Initialization

**User Story:** As a developer, I want a pnpm monorepo with defined workspaces, so that I can manage frontend and backend packages from a single repository with shared tooling.

#### Acceptance Criteria

1. THE Monorepo SHALL contain a root `package.json` with `"private": true` and a pnpm workspace configuration.
2. THE Monorepo SHALL define workspaces for `frontend` and `backend` directories in `pnpm-workspace.yaml`.
3. WHEN a developer runs `pnpm install` at the repository root, THE Monorepo SHALL install dependencies for all defined workspaces.

### Requirement 2: Frontend React Application Setup

**User Story:** As a developer, I want a React application scaffolded in the frontend workspace, so that I can build the evaluation tool's visual UI.

#### Acceptance Criteria

1. THE Frontend_App SHALL be scaffolded using the Vite CLI (`pnpm create vite`) with the React TypeScript template, located in the `frontend/` directory.
2. THE Frontend_App SHALL include TanStack Query (`@tanstack/react-query`) as a dependency for server state management.
3. THE Frontend_App SHALL include Tailwind CSS configured for utility-first styling.
4. THE Frontend_App SHALL include shadcn/ui initialized and configured as the component library.
5. THE Frontend_App SHALL include a TypeScript configuration (`tsconfig.json`) extending the root TypeScript configuration.
6. WHEN a developer runs the build command, THE Frontend_App SHALL produce static output files in a `dist/` directory.
7. THE Frontend_App SHALL include a minimal entry point (`src/main.tsx`) that renders a root React component with a TanStack Query provider.

### Requirement 3: Backend TypeScript Lambda Setup

**User Story:** As a developer, I want a TypeScript Lambda project in the backend workspace, so that I can implement API handlers for the evaluation tool.

#### Acceptance Criteria

1. THE Backend_API SHALL be a TypeScript project located in the `backend/` directory with its own `package.json`.
2. THE Backend_API SHALL include a TypeScript configuration (`tsconfig.json`) extending the root TypeScript configuration and targeting a Node.js-compatible output.
3. THE Backend_API SHALL include a sample Lambda handler file (`src/handlers/health.ts`) that returns a 200 status response.
4. THE Backend_API SHALL include the `@aws-sdk/client-lambda` package as a dependency for invoking the Python_Lambda directly.
5. THE Backend_API SHALL read resource references (e.g., Python_Lambda function name) from environment variables set by the SAM_Template via CloudFormation_Output values.

### Requirement 4: Python Lambda for Evaluation Tools

**User Story:** As a developer, I want a standalone Python Lambda function, so that the TypeScript API handlers can invoke deepeval and fmeval for model evaluation scoring.

#### Acceptance Criteria

1. THE Python_Lambda SHALL be defined in a `backend/python/` directory containing a `Dockerfile`, a handler file, and a `requirements.txt`.
2. THE Python_Lambda SHALL list `deepeval` and `fmeval` as dependencies in `requirements.txt`.
3. THE Python_Lambda SHALL include a handler entry point (`handler.py`) that accepts an event payload and returns a structured JSON response.
4. WHEN the SAM_Template deploys the Python_Lambda, THE Python_Lambda SHALL use a container image based on `public.ecr.aws/lambda/python:3.12` because `deepeval` and `fmeval` exceed the Lambda zip package size limit.
5. THE Python_Lambda SHALL be a standalone Lambda function not attached to any API Gateway route.
6. THE Python_Lambda SHALL use `PackageType: Image` in the SAM_Template with Dockerfile metadata for container image builds.

### Requirement 5: AWS SAM Infrastructure Configuration

**User Story:** As a developer, I want AWS SAM infrastructure-as-code that wires together the frontend, backend, and Python Lambda, so that the entire stack is deployable with a single command.

#### Acceptance Criteria

1. THE SAM_Template SHALL define a `template.yaml` at the repository root using the AWS SAM template format with CloudFormation resources.
2. THE SAM_Template SHALL define an API Gateway HTTP API resource with at least one route pointing to the health handler.
3. THE SAM_Template SHALL define CloudFront and S3 resources for deploying the Frontend_App as a Static_Site from the `frontend/dist/` build output.
4. THE SAM_Template SHALL define the Python_Lambda as a standalone `AWS::Serverless::Function` resource using the Python 3.12 runtime and the `backend/python/` handler, not attached to any API Gateway route.
5. THE SAM_Template SHALL pass the Python_Lambda function name to the Backend_API handler functions as an environment variable so the TypeScript handlers can invoke the Python_Lambda using the AWS SDK.
6. THE SAM_Template SHALL define CloudFormation_Output values for the API Gateway URL and CloudFront distribution URL.
7. WHEN a developer runs `sam build && sam deploy`, THE SAM_Template SHALL build and deploy all components (API Gateway, Static_Site, Python_Lambda) to AWS.
8. THE infra/ directory SHALL contain any supplementary SAM configuration or helper templates referenced by the root SAM_Template.

### Requirement 6: Shared TypeScript Configuration

**User Story:** As a developer, I want consistent TypeScript settings across all workspaces, so that code quality and compilation behavior are uniform.

#### Acceptance Criteria

1. THE Monorepo SHALL use the existing root `tsconfig.json` (extending `@tsconfig/node24`) as the base TypeScript configuration with strict mode and ES module settings.
2. THE Frontend_App SHALL extend the root TypeScript configuration for shared compiler options.
3. THE Backend_API SHALL extend the root TypeScript configuration for shared compiler options.

### Requirement 7: Vitest Test Configuration

**User Story:** As a developer, I want a root-level Vitest configuration, so that I can run tests across all workspaces with consistent settings and path resolution.

#### Acceptance Criteria

1. THE Monorepo SHALL include a root `vitest.config.ts` file defining the shared test runner configuration.
2. THE Vitest_Config SHALL use `vite-tsconfig-paths` to resolve TypeScript path aliases defined in the root `tsconfig.json`.
3. THE Monorepo SHALL include `vitest` and `vite-tsconfig-paths` as root-level devDependencies.

### Requirement 8: Code Quality Tooling

**User Story:** As a developer, I want consistent code formatting and linting across the project, so that the codebase maintains a uniform style and catches issues early.

#### Acceptance Criteria

1. THE Monorepo SHALL include Prettier as a root-level devDependency with a `.prettierrc` configuration file.
2. THE Monorepo SHALL include `prettier-plugin-organize-imports` as a Prettier plugin for automatic import sorting.
3. THE Monorepo SHALL include ESLint as a root-level devDependency with a flat configuration file (`eslint.config.js`).
4. THE Monorepo SHALL include `eslint-config-prettier` integrated via `eslint-config-prettier/flat` to disable ESLint rules that conflict with Prettier.

### Requirement 9: Development Workflow Support

**User Story:** As a developer, I want root-level scripts to run common tasks across workspaces, so that I can develop and build efficiently.

#### Acceptance Criteria

1. THE Monorepo SHALL define a root `dev` script that starts SAM local development using `sam local start-api` for local API testing.
2. THE Monorepo SHALL define a root `build` script that builds all workspaces and runs `sam build` for the infrastructure.
3. THE Monorepo SHALL define a root `test` script that runs Vitest across all workspaces.
4. THE Monorepo SHALL define a root `lint` script that runs ESLint across all workspaces.
5. THE Monorepo SHALL define a root `format` script that runs Prettier across all workspaces.
6. WHEN a developer runs `pnpm dev` at the repository root, THE Monorepo SHALL start the SAM local development environment for API testing.
