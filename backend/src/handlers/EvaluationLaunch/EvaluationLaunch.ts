import { inject } from '@trackit.io/di-container';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
  EvaluationLaunchResponse,
  EvaluationRequest,
} from '../../models/Evaluation';
import { tokenEvaluationLaunchUseCase } from '../../useCases/EvaluationLaunch/EvaluationLaunchUseCase';

const useCase = inject(tokenEvaluationLaunchUseCase);

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_BODY',
            message: 'Request body is required',
          },
        } as EvaluationLaunchResponse),
      };
    }

    const request: EvaluationRequest = JSON.parse(event.body);

    if (!request.dataset_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_DATASET_ID',
            message: 'dataset_id is required',
          },
        } as EvaluationLaunchResponse),
      };
    }

    if (!request.models) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_MODELS',
            message: 'models array is required',
          },
        } as EvaluationLaunchResponse),
      };
    }

    const job = await useCase.launchEvaluation(request);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          evaluation_id: job.evaluation_id,
          status: job.status,
          created_at: job.created_at,
        },
      } as EvaluationLaunchResponse),
    };
  } catch (error) {
    console.error('Error launching evaluation:', error);

    const isValidationError =
      error instanceof Error &&
      (error.message.includes('must be') ||
        error.message.includes('Invalid') ||
        error.message.includes('required') ||
        error.message.includes('non-negative'));

    const statusCode = isValidationError ? 400 : 500;
    const errorCode = isValidationError ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';

    return {
      statusCode,
      body: JSON.stringify({
        success: false,
        error: {
          code: errorCode,
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
        },
      } as EvaluationLaunchResponse),
    };
  }
};
