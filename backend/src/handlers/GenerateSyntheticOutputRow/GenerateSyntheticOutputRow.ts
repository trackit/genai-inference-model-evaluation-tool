import { SyntheticOutputRow } from '../../models/SyntheticOutput';
import { GenerateSyntheticOutputRowAdapter } from './GenerateSyntheticOutputRowAdapter';

const adapter = new GenerateSyntheticOutputRowAdapter();

export const handler = async (event: unknown): Promise<SyntheticOutputRow> =>
  adapter.handle(event);
