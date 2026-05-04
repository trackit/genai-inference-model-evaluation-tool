# Contributing to GenAI Inference Model Evaluation Tool

Thank you for your interest in contributing to GenAI Inference Model Evaluation Tool! We welcome your PRs, issues, feedback, and other contributions to this open source repository. To keep things moving smoothly, please use the following guidelines when working with this source code.

## License

By contributing code to GenAI Inference Model Evaluation Tool, you warrant that you either have the rights to your contributions or have obtained the necessary permissions to license them under the [repository license](./LICENSE), ensuring that your code can be legally distributed under these terms.

## Getting Started

Please read the [README](./README.md) for prerequisites, environment variables, SAM deployment, and how to run the stack and API locally. The [Local stack deployment](./README.md#local-stack-deployment) and [Running the API locally with SAM](./README.md#running-the-api-locally-with-sam) sections cover most of what you need to develop against real AWS resources.

## Development Setup

- Install dependencies with `pnpm install`
- Use `pnpm run start:webui` for the frontend dev server (Vite)
- Use `pnpm run dev` to run the API locally with SAM (`sam local start-api`) once your stack and `.env` are configured as described in the README

## Code Style

- Run `pnpm run lint` to check linting issues
- Run `pnpm exec prettier --check .` to validate formatting without writing files
- Run `pnpm run format` to apply formatting changes

## Testing

- Backend tests: `pnpm run test:backend`
- Scoped backend suites: `pnpm run test:handlers`, `pnpm run test:usecases`, or `pnpm run test:services`
- Frontend tests: `pnpm exec vitest run frontend/`
- Full test suite: `pnpm run test` (see [Running tests](./README.md#running-tests) in the README)

## Commit Messages

Use concise, present-tense commit messages that describe the change. Example: `feat: add validation for evaluation job payload`.

## Questions?

Please ask all questions in the form of GitHub issues.
