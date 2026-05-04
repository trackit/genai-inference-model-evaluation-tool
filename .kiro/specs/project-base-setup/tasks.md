# Implementation Plan: Project Base Setup

## Overview

Set up the pnpm monorepo skeleton for the Bedrock Model Evaluation Tool. Tasks proceed from root configuration outward: monorepo config → shared tooling → frontend workspace → backend workspace → Python Lambda → SAM template → wiring and validation. Each task builds incrementally so the project is always in a buildable state.

## Tasks

- [x] 1. Initialize root monorepo configuration and shared tooling
  - [x] 1.1 Create root `package.json` with `"private": true`, workspace scripts (`dev`, `build`, `test`, `lint`, `format`), and shared devDependencies (`vitest`, `vite-tsconfig-paths`, `prettier`, `prettier-plugin-organize-imports`, `eslint`, `eslint-config-prettier`, `typescript`, `@tsconfig/node24`)
    - Root scripts: `"dev": "sam local start-api"`, `"build": "pnpm -r build && sam build"`, `"test": "vitest run"`, `"lint": "eslint ."`, `"format": "prettier --write ."`
    - _Requirements: 1.1, 7.3, 8.1, 8.3, 9.1, 9.2, 9.3, 9.4, 9.5_
  - [x] 1.2 Create `pnpm-workspace.yaml` defining `frontend` and `backend` workspaces
    - _Requirements: 1.2, 1.3_
  - [x] 1.3 Create root `vitest.config.ts` with `vite-tsconfig-paths` plugin for path alias resolution
    - _Requirements: 7.1, 7.2_
  - [x] 1.4 Create `.prettierrc` with `prettier-plugin-organize-imports` plugin
    - _Requirements: 8.1, 8.2_
  - [x] 1.5 Create `eslint.config.js` using flat config with `eslint-config-prettier/flat`
    - _Requirements: 8.3, 8.4_

- [x] 2. Scaffold frontend workspace using Vite CLI and install additional dependencies
  - [x] 2.1 Run `pnpm create vite frontend --template react-ts` to scaffold the React TypeScript project via Vite CLI
    - This generates `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/index.css`
    - _Requirements: 2.1_
  - [x] 2.2 Install additional frontend dependencies: `@tanstack/react-query`, `tailwindcss`, `@tailwindcss/vite`
    - Run `pnpm --filter frontend add @tanstack/react-query` and `pnpm --filter frontend add -D tailwindcss @tailwindcss/vite`
    - _Requirements: 2.2, 2.3_
  - [x] 2.3 Update `frontend/vite.config.ts` to add the Tailwind CSS Vite plugin alongside the React plugin
    - _Requirements: 2.3_
  - [x] 2.4 Update `frontend/src/index.css` to include the Tailwind CSS `@import "tailwindcss"` directive
    - _Requirements: 2.3_
  - [x] 2.5 Initialize shadcn/ui by running `pnpm dlx shadcn@latest init` inside the `frontend/` directory, creating `components.json` and `src/lib/utils.ts`
    - _Requirements: 2.4_
  - [x] 2.6 Update `frontend/tsconfig.json` to extend the root TypeScript configuration
    - _Requirements: 2.5, 6.2_
  - [x] 2.7 Update `frontend/src/main.tsx` to wrap the root `<App />` component in a `QueryClientProvider`
    - _Requirements: 2.7_

- [x] 3. Scaffold backend workspace
  - [x] 3.1 Create `backend/package.json` with `@aws-sdk/client-lambda` dependency and `@types/aws-lambda` dev dependency
    - _Requirements: 3.1, 3.4_
  - [x] 3.2 Create `backend/tsconfig.json` extending the root TypeScript configuration
    - _Requirements: 3.2, 6.3_
  - [x] 3.3 Create `backend/src/handlers/health.ts` — health check Lambda handler returning `{ statusCode: 200, body: '{"status":"ok"}' }`
    - Uses `APIGatewayProxyEventV2` and `APIGatewayProxyResultV2` types
    - _Requirements: 3.3, 3.5_

- [x] 4. Create Python Lambda for evaluation tools
  - [x] 4.1 Create `backend/python/handler.py` — skeleton handler accepting an event and returning structured JSON response
    - _Requirements: 4.1, 4.3_
  - [x] 4.2 Create `backend/python/requirements.txt` listing `deepeval` and `fmeval`
    - _Requirements: 4.2_
  - [x] 4.3 Create `backend/python/Dockerfile` using `public.ecr.aws/lambda/python:3.12` base image, installing requirements and copying handler
    - _Requirements: 4.4, 4.6_

- [x] 5. Checkpoint — Verify workspace structure
  - Ensure all workspace files are created and consistent. Run `pnpm install` to verify workspace resolution. Ask the user if questions arise.

- [x] 6. Create AWS SAM infrastructure template
  - [x] 6.1 Create `template.yaml` at the repository root with SAM Transform, Globals, and Parameters
    - Define `AWS::Serverless-2016-10-31` Transform
    - Set global function defaults (timeout, memory, runtime `nodejs20.x`, architecture `x86_64`)
    - _Requirements: 5.1_
  - [x] 6.2 Add `ServerlessHttpApi` resource (API Gateway HTTP API v2) with CORS configuration
    - _Requirements: 5.2_
  - [x] 6.3 Add `HealthFunction` resource — TypeScript Lambda with esbuild metadata, `/health` GET route, `EVAL_FUNCTION_NAME` env var from `!Ref EvalFunction`, and `LambdaInvokePolicy`
    - Metadata: `BuildMethod: esbuild`, `EntryPoints: [src/handlers/health.ts]`, `External: ["@aws-sdk/*"]`
    - _Requirements: 5.2, 5.5_
  - [x] 6.4 Add `EvalFunction` resource — Python 3.12 container image Lambda with `PackageType: Image`, Dockerfile metadata, 900s timeout, 1024MB memory, no API Gateway events
    - _Requirements: 4.4, 4.5, 4.6, 5.4_
  - [x] 6.5 Add `FrontendBucket` (S3), `FrontendBucketPolicy`, `CloudFrontOAC`, and `CloudFrontDistribution` resources for static site hosting
    - CloudFront with OAC, SPA error responses (403→200, 404→200 to `/index.html`)
    - _Requirements: 5.3_
  - [x] 6.6 Add `Outputs` section with `ApiUrl` and `CloudFrontUrl`
    - _Requirements: 5.6_

- [x] 7. Create supplementary infra configuration
  - [x] 7.1 Create `infra/samconfig.toml` with default deployment configuration (stack name, region, capabilities)
    - _Requirements: 5.8_

- [x] 8. Checkpoint — Validate SAM template
  - Ensure `sam validate --lint` passes on `template.yaml`. Ensure all tests pass. Ask the user if questions arise.

- [x] 9. Write tests for Lambda handlers and configuration
  - [x]\* 9.1 Write property test: Health handler always returns 200 with valid JSON body (Property 1)
    - **Property 1: Health handler always returns 200 with valid JSON body**
    - **Validates: Requirements 3.3**
  - [x]\* 9.2 Write property test: Python evaluation handler returns structured response (Property 2)
    - **Property 2: Python evaluation handler returns structured response**
    - Note: This is a Python handler — write as a Vitest test that invokes the handler via subprocess or validate the contract in TypeScript
    - **Validates: Requirements 4.3**
  - [x]\* 9.3 Write unit tests verifying key configuration files
    - Verify root `package.json` has `"private": true` and required scripts
    - Verify `pnpm-workspace.yaml` lists `frontend` and `backend`
    - Verify `template.yaml` has SAM Transform, HttpApi, CloudFront, S3, Outputs
    - Verify `backend/python/requirements.txt` lists `deepeval` and `fmeval`
    - **Validates: Requirements 1.1, 1.2, 5.1, 5.2, 5.3, 5.6, 4.2**

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The frontend is scaffolded using `pnpm create vite frontend --template react-ts`, then enhanced with additional dependencies and config updates
- The root `tsconfig.json` already exists and extends `@tsconfig/node24` — tasks reference it but do not recreate it
