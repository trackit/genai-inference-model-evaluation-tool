import { createInjectionToken } from '@trackit.io/di-container';

import type {
  SyntheticOutputModelClient,
  SyntheticOutputModelRequest,
  SyntheticOutputModelResult,
} from '../../ports/SyntheticOutputModelClient';
import { PermanentModelError, TransientModelError } from './classifyModelError';

export class FakeSyntheticOutputModelClient implements SyntheticOutputModelClient {
  public readonly requests: SyntheticOutputModelRequest[] = [];
  private readonly queuedResults: Array<
    string | TransientModelError | PermanentModelError
  > = [];

  queueOutput(output: string): void {
    this.queuedResults.push(output);
  }

  queueError(error: TransientModelError | PermanentModelError): void {
    this.queuedResults.push(error);
  }

  async generate(
    request: SyntheticOutputModelRequest,
  ): Promise<SyntheticOutputModelResult> {
    this.requests.push(request);

    const nextResult = this.queuedResults.shift();
    if (
      nextResult instanceof TransientModelError ||
      nextResult instanceof PermanentModelError
    ) {
      throw nextResult;
    }

    return {
      output: nextResult ?? 'fake synthetic output',
      modelId: request.modelId ?? 'fake-synthetic-output-model',
    };
  }
}

export const tokenFakeSyntheticOutputModelClient =
  createInjectionToken<FakeSyntheticOutputModelClient>(
    'FakeSyntheticOutputModelClient',
    {
      useClass: FakeSyntheticOutputModelClient,
    },
  );
