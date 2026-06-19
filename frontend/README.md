# Frontend — GenAI Inference Model Evaluation Tool

React 19 + Vite + Tailwind application that drives the four-step model evaluation workflow.

## Tech stack

| Layer                | Library / Tool            |
| -------------------- | ------------------------- |
| Framework            | React 19                  |
| Build tool           | Vite 7                    |
| Styling              | Tailwind CSS 4            |
| Component primitives | Radix UI, Base UI, shadcn |
| Animations           | Framer Motion             |
| Charts               | Recharts                  |
| Data fetching        | TanStack Query v5         |
| Routing              | React Router v7           |
| Testing              | Vitest + Testing Library  |
| Language             | TypeScript 5              |

## Project structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── evaluator/          # Step components for the evaluation workflow
│   │   │   ├── MetricsWeights.tsx    # Step 1 — tune accuracy / latency / cost weights
│   │   │   ├── ModelSelection.tsx    # Step 2 — pick Bedrock models to evaluate
│   │   │   ├── DatasetUpload.tsx     # Step 3 — upload dataset and pick metrics to compute
│   │   │   ├── MetricsPicker.tsx     # Task-aware picker for which metrics to compute
│   │   │   ├── ProgressView.tsx      # Step 4a — real-time job progress
│   │   │   ├── ResultsView.tsx       # Step 4b — ranked results and recommendation
│   │   │   └── StepIndicator.tsx     # Navigation breadcrumb for the stepper
│   │   └── ui/                 # Reusable primitives (Button, Checkbox, Slider, Tooltip)
│   ├── hooks/
│   │   ├── useEvaluation.ts    # Core orchestration hook — manages stepper state and API calls
│   │   └── use-mobile.tsx      # Responsive breakpoint hook
│   ├── pages/
│   │   ├── Index.tsx           # Main page — renders the evaluation stepper
│   │   └── NotFound.tsx        # 404 fallback
│   ├── services/
│   │   ├── apiService.ts       # Typed API client (dataset upload, evaluation CRUD)
│   │   └── apiService.test.ts  # API client contract tests
│   ├── types/
│   │   └── evaluation.ts       # Shared TypeScript interfaces and constants
│   ├── lib/
│   │   └── utils.ts            # Utility helpers (clsx/tailwind-merge)
│   ├── App.tsx                 # Root component with router
│   └── main.tsx                # Entry point
├── scripts/
│   ├── generate-env-vars.sh    # Injects SSM parameters into the build
│   └── deploy.sh               # Syncs the built dist/ to S3 + invalidates CloudFront
├── .env.example                # Environment variable template
├── vite.config.ts
└── package.json
```

## Getting started

### Prerequisites

- Node.js 24+
- pnpm 10+

### Setup

```bash
# from the repo root
pnpm install

# copy the environment template
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env` with the API Gateway URL printed at the end of the SAM deploy and the stage of deployment:

```env
VITE_API_URL=https://<api-id>.execute-api.us-west-2.amazonaws.com
STAGE=dev
VITE_CODE_TTL_MINUTES=30
```

### Run the dev server

```bash
pnpm start:webui
```

The app is served at `http://localhost:5173`.

## Available scripts

| Script     | Command             | Description                                  |
| ---------- | ------------------- | -------------------------------------------- |
| Dev server | `pnpm dev`          | Start Vite with HMR at http://localhost:5173 |
| Build      | `pnpm build`        | Type-check and bundle to `dist/`             |
| Preview    | `pnpm preview`      | Serve the production build locally           |
| Lint       | `pnpm lint`         | Run ESLint                                   |
| Test       | `pnpm test`         | Run Vitest in watch mode                     |
| Deploy     | `pnpm deploy:webui` | Generate env vars, build, and sync to S3     |

## Testing

Tests use **Vitest** and **Testing Library** and are colocated with their modules.

```bash
# from the frontend directory
pnpm test

# or from the repo root
pnpm test:frontend
```

The main test file (`src/services/apiService.test.ts`) verifies the API client contract — request shapes, response parsing, and error handling — without hitting a real endpoint.

## Environment variables

| Variable       | Required        | Description                                   |
| -------------- | --------------- | --------------------------------------------- |
| `VITE_API_URL` | Yes             | Base URL of the deployed API Gateway HTTP API |
| `STAGE`        | Deployment only | Deployment stage used by the deploy scripts   |

All variables are consumed at build time by Vite; only `VITE_`-prefixed variables are exposed to the browser bundle.
