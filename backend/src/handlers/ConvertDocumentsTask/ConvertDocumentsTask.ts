import { inject } from '@trackit.io/di-container';

import {
  ConvertDocumentsTaskInput,
  ConvertDocumentsTaskOutput,
  tokenConvertDocumentsTaskUseCase,
} from '../../useCases/ConvertDocumentsTask/ConvertDocumentsTaskUseCase';

export const handler = async (
  event: ConvertDocumentsTaskInput,
): Promise<ConvertDocumentsTaskOutput> =>
  inject(tokenConvertDocumentsTaskUseCase).execute(event);
