export class TransientModelError extends Error {
  readonly originalErrorName: string;
  readonly cause?: unknown;

  constructor(originalErrorName: string, cause?: unknown) {
    super(`Transient Bedrock error: ${originalErrorName}`);
    this.name = 'TransientModelError';
    this.originalErrorName = originalErrorName;
    this.cause = cause;
    Object.setPrototypeOf(this, TransientModelError.prototype);
  }
}

export class PermanentModelError extends Error {
  readonly originalErrorName: string;
  readonly cause?: unknown;

  constructor(originalErrorName: string, cause?: unknown) {
    super(`Permanent Bedrock error: ${originalErrorName}`);
    this.name = 'PermanentModelError';
    this.originalErrorName = originalErrorName;
    this.cause = cause;
    Object.setPrototypeOf(this, PermanentModelError.prototype);
  }
}

/**
 * Not a Bedrock SDK exception - the Converse call can return HTTP 200 with
 * empty/whitespace-only text. Retrying the exact same request would produce
 * the same result, so this is treated as permanent, same as a validation error.
 */
export class EmptyModelOutputError extends Error {
  constructor() {
    super('Bedrock Converse call returned empty output');
    this.name = 'EmptyModelOutputError';
    Object.setPrototypeOf(this, EmptyModelOutputError.prototype);
  }
}

const TRANSIENT_ERROR_NAMES = new Set<string>([
  'ThrottlingException', // 429 - account quota exceeded, retry with backoff
  'ModelTimeoutException', // 408 - processing exceeded the model timeout
  'ServiceUnavailableException', // 503 - service temporarily unavailable
  'InternalServerException', // 500 - internal Bedrock error
  'ModelNotReadyException', // 429 - model still warming up
]);

const PERMANENT_ERROR_NAMES = new Set<string>([
  'ValidationException', // 400 - request violates Bedrock's constraints
  'AccessDeniedException', // 403 - IAM/permissions issue, retrying will not help
  'ResourceNotFoundException', // 404 - invalid modelId/ARN, a configuration error
  'ModelErrorException', // 424 - model failed to process this specific input
  'EmptyModelOutputError', // our own semantic-validation error, see class above
]);

function getErrorName(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    typeof (error as { name: unknown }).name === 'string'
  ) {
    return (error as { name: string }).name;
  }
  return 'UnknownError';
}

/**
 * Classifies any error thrown by a Bedrock Converse call
 * into a retryable or non-retryable model error.
 *
 * Unrecognized error names fail closed as PermanentModelError: an error we
 * don't recognize (a bug, a new/uncatalogued SDK exception) should surface
 * immediately for investigation rather than being retried indefinitely.
 */
export function classifyModelError(
  error: unknown,
): TransientModelError | PermanentModelError {
  // Idempotency
  if (
    error instanceof TransientModelError ||
    error instanceof PermanentModelError
  ) {
    return error;
  }

  const name = getErrorName(error);

  if (TRANSIENT_ERROR_NAMES.has(name)) {
    return new TransientModelError(name, error);
  }

  if (PERMANENT_ERROR_NAMES.has(name)) {
    return new PermanentModelError(name, error);
  }

  return new PermanentModelError(name, error);
}
