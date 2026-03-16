---
inclusion: auto
---

# Coding Standards for Bedrock Model Evaluation Tool

## File Naming and Organization

### PascalCase for All Files
- Use PascalCase for all TypeScript/JavaScript files
- Examples: `DatasetUpload.ts`, `CsvParser.ts`, `DatasetService.ts`

### Feature-Based Folder Structure
Each Lambda handler must have its own dedicated folders:

```
backend/src/
├── handlers/
│   ├── DatasetUpload/
│   │   ├── DatasetUpload.ts          # Lambda handler
│   │   └── DatasetUpload.test.ts     # Handler tests
│   ├── EvaluationLaunch/
│   │   ├── EvaluationLaunch.ts
│   │   └── EvaluationLaunch.test.ts
│   ├── EvaluationStatus/
│   │   ├── EvaluationStatus.ts
│   │   └── EvaluationStatus.test.ts
│   └── EvaluationResults/
│       ├── EvaluationResults.ts
│       └── EvaluationResults.test.ts
├── use-cases/
│   ├── DatasetUpload/
│   │   ├── DatasetUploadUseCase.ts
│   │   └── DatasetUploadUseCase.test.ts
│   ├── EvaluationLaunch/
│   │   ├── EvaluationLaunchUseCase.ts
│   │   └── EvaluationLaunchUseCase.test.ts
│   └── ...
├── services/
│   ├── DatasetService/
│   │   ├── DatasetService.ts
│   │   └── DatasetService.test.ts
│   ├── EvaluationService/
│   │   ├── EvaluationService.ts
│   │   └── EvaluationService.test.ts
│   └── ...
├── parsers/
│   ├── CsvParser.ts
│   └── JsonlParser.ts
└── models/
    └── Dataset.ts
```

## Code Style

### Minimal Comments
- Code should be self-documenting through clear naming
- Only add comments for complex business logic or non-obvious decisions
- Avoid redundant comments that repeat what the code does

**Bad:**
```typescript
// Get the dataset from S3
const dataset = await s3.getObject(params);
```

**Good:**
```typescript
const dataset = await s3.getObject(params);
```

**Acceptable (non-obvious logic):**
```typescript
// Normalize weights to sum to 1.0 for weighted score calculation
const normalizedWeights = weights.map(w => w / totalWeight);
```

### Immutability
- Always create new objects, never mutate existing ones
- Use spread operators, map, filter, reduce instead of push, splice, etc.

**Bad:**
```typescript
const results = [];
for (const item of items) {
  results.push(transform(item));
}
```

**Good:**
```typescript
const results = items.map(transform);
```

### Error Handling
- Handle errors at every level
- Use consistent error response format
- Never silently swallow errors

```typescript
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return { 
    success: false, 
    error: error instanceof Error ? error.message : 'Unknown error' 
  };
}
```

### Function Size
- Keep functions small (<50 lines)
- Single responsibility principle
- Extract complex logic into separate functions

### File Size
- Target: 200-400 lines per file
- Maximum: 1200 lines
- Split large files into smaller, focused modules if possible

## Package Management

### Single package.json Structure
- Use pnpm as the package manager (not npm or yarn)
- Single root package.json contains all dependencies (runtime and dev)
- Install dependencies: `pnpm install`
- Add dependency: `pnpm add <package>`
- Add dev dependency: `pnpm add -D <package>`

### Test Scopes
Run tests at different levels:
- `pnpm test` - Run all tests
- `pnpm test:backend` - Run all backend tests
- `pnpm test:handlers` - Run handler tests only
- `pnpm test:usecases` - Run use case tests only
- `pnpm test:services` - Run service tests only

## Testing

### Test-Driven Development (TDD)
1. Write test first (RED) - test should FAIL
2. Write minimal implementation (GREEN) - test should PASS
3. Refactor (IMPROVE) - verify coverage 80%+

### Test File Naming
- Place test files next to implementation: `DatasetUpload.test.ts` next to `DatasetUpload.ts`
- Use descriptive test names: `describe('DatasetUploadUseCase')` and `it('should reject datasets with fewer than 10 samples')`

### Minimum Coverage
- 80%+ code coverage required
- Unit tests for all functions
- Integration tests for API endpoints


## Architecture Patterns

### Layered Architecture
Every Lambda follows this pattern:
1. **Handler** - Parse request, call use case, format response
2. **Use Case** - Business logic orchestration
3. **Service** - External integrations (S3, DynamoDB, Bedrock)

### Dependency Injection
- Use `trackit.dependencyinjection` package with injection tokens
- Inject dependencies via `inject()` and expose via `createInjectionToken()`
```typescript
export class DatasetUploadUseCaseImpl implements DatasetUploadUseCase {
  private readonly datasetService = inject(tokenDatasetService);
  private readonly csvParser = inject(tokenCsvParser);
  private readonly jsonlParser = inject(tokenJsonlParser);
}

export const tokenDatasetUploadUseCase =
  createInjectionToken<DatasetUploadUseCase>(
    'DatasetUploadUseCase',
    { useClass: DatasetUploadUseCaseImpl },
  );
```

### API Response Format
Consistent envelope for all responses:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}
```

## Security

### Input Validation
- Validate all user input at system boundaries
- Use schema-based validation (Zod, Joi)
- Fail fast with clear error messages

### No Hardcoded Secrets
- Use environment variables for all configuration
- Never commit secrets to version control

### Least-Privilege IAM
- Each Lambda has minimal required permissions
- No wildcard permissions except where necessary (e.g., Bedrock models)

## TypeScript Best Practices

### Strict Type Safety
- Enable strict mode in tsconfig.json
- Avoid `any` type - use `unknown` if type is truly unknown
- Define interfaces for all data structures

### Type Definitions
```typescript
export interface Dataset {
  datasetId: string;
  samples: DatasetSample[];
  sampleCount: number;
  hasReferenceOutputs: boolean;
  hasContext: boolean;
}

export interface DatasetSample {
  prompt: string;
  context?: string;
  referenceOutput?: string;
}
```

## Python Best Practices (for Evaluation Engine)

### File Naming
- Use snake_case for Python files: `dataset_loader.py`, `bedrock_client.py`
- Follow PEP 8 style guide

### Type Hints
- Use type hints for all function signatures
- Use dataclasses for structured data

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class InvocationResult:
    response_text: str
    input_tokens: int
    output_tokens: int
    time_to_first_token: float
    total_latency: float
    error: Optional[str] = None
```

## Git Workflow

### Commit Format
Use conventional commits:
- `feat: add dataset upload handler`
- `fix: correct CSV parsing for empty fields`
- `refactor: extract validation logic to separate function`
- `test: add unit tests for JSONL parser`
- `docs: update API documentation`

### Branch Strategy
- `main` - production-ready code
- Feature branches: `feature/dataset-upload`, `feature/evaluation-engine`
- Bug fixes: `fix/csv-parser-edge-case`

## Documentation

### README Files
- Each major component should have a README
- Include setup instructions, usage examples, and testing instructions

### API Documentation
- Document all API endpoints with request/response examples
- Include error codes and their meanings

### Code Documentation
- Minimal inline comments (code should be self-documenting)
- Document complex algorithms or business logic
- Use JSDoc/TSDoc for public APIs only when necessary
