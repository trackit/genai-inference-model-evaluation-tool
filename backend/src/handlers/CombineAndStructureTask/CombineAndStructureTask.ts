import { inject } from '@trackit.io/di-container';

import {
  CombineAndStructureTaskInput,
  CombineAndStructureTaskOutput,
  tokenCombineAndStructureTaskUseCase,
} from '../../useCases/CombineAndStructureTask/CombineAndStructureTaskUseCase';

export const handler = async (
  event: CombineAndStructureTaskInput,
): Promise<CombineAndStructureTaskOutput> =>
  inject(tokenCombineAndStructureTaskUseCase).execute(event);
