import { describe, expect, it } from 'vitest';
import {
  classifyModelError,
  EmptyModelOutputError,
  PermanentModelError,
  TransientModelError,
} from './classifyModelError';

function bedrockError(name: string): Error {
  const error = new Error(`simulated ${name}`);
  error.name = name;
  return error;
}

describe('classifyModelError', () => {
  it.each([
    ['ThrottlingException'],
    ['ModelTimeoutException'],
    ['ServiceUnavailableException'],
    ['InternalServerException'],
    ['ModelNotReadyException'],
  ])('classifies %s as TransientModelError', (name) => {
    const result = classifyModelError(bedrockError(name));

    expect(result).toBeInstanceOf(TransientModelError);
    expect(result.originalErrorName).toBe(name);
  });

  it.each([
    ['ValidationException'],
    ['AccessDeniedException'],
    ['ResourceNotFoundException'],
    ['ModelErrorException'],
  ])('classifies %s as PermanentModelError', (name) => {
    const result = classifyModelError(bedrockError(name));

    expect(result).toBeInstanceOf(PermanentModelError);
    expect(result.originalErrorName).toBe(name);
  });

  it('classifies EmptyModelOutputError as PermanentModelError', () => {
    const result = classifyModelError(new EmptyModelOutputError());

    expect(result).toBeInstanceOf(PermanentModelError);
    expect(result.originalErrorName).toBe('EmptyModelOutputError');
  });

  it('fails closed: classifies an unrecognized error name as PermanentModelError', () => {
    const result = classifyModelError(
      bedrockError('SomeFutureBedrockException'),
    );

    expect(result).toBeInstanceOf(PermanentModelError);
    expect(result.originalErrorName).toBe('SomeFutureBedrockException');
  });

  it('fails closed: classifies a non-Error value with no name as PermanentModelError', () => {
    const result = classifyModelError('not an error object');

    expect(result).toBeInstanceOf(PermanentModelError);
    expect(result.originalErrorName).toBe('UnknownError');
  });

  it('preserves the original error as cause for debugging', () => {
    const original = bedrockError('ThrottlingException');
    const result = classifyModelError(original);

    expect(result.cause).toBe(original);
  });
});
