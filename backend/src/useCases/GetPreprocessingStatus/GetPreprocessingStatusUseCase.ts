import { createInjectionToken, inject } from '@trackit.io/di-container';

import { tokenStepFunctionsService } from '../../services/StepFunctionsService/StepFunctionsServiceImpl';

export type PreprocessingStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface GetPreprocessingStatusResult {
  status: PreprocessingStatus;
  structuredDatasetArtifactKey?: string;
  sampleCount?: number;
}

export type GetPreprocessingStatusUseCase = {
  execute(input: {
    executionArn: string;
  }): Promise<GetPreprocessingStatusResult>;
};

export class GetPreprocessingStatusUseCaseImpl implements GetPreprocessingStatusUseCase {
  private readonly stepFunctions = inject(tokenStepFunctionsService);

  async execute({
    executionArn,
  }: {
    executionArn: string;
  }): Promise<GetPreprocessingStatusResult> {
    const { status, output } =
      await this.stepFunctions.describeExecution(executionArn);

    if (status === 'SUCCEEDED') {
      const parsed = output
        ? (JSON.parse(output) as Record<string, unknown>)
        : {};
      return {
        status: 'SUCCEEDED',
        structuredDatasetArtifactKey:
          typeof parsed.structuredDatasetArtifactKey === 'string'
            ? parsed.structuredDatasetArtifactKey
            : undefined,
        sampleCount:
          typeof parsed.sampleCount === 'number'
            ? parsed.sampleCount
            : undefined,
      };
    }

    if (status === 'RUNNING') {
      return { status: 'RUNNING' };
    }

    return { status: 'FAILED' };
  }
}

export const tokenGetPreprocessingStatusUseCase =
  createInjectionToken<GetPreprocessingStatusUseCase>(
    'GetPreprocessingStatusUseCase',
    { useClass: GetPreprocessingStatusUseCaseImpl },
  );
