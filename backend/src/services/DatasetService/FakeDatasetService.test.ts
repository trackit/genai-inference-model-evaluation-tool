import { describe, expect, it } from 'vitest';
import { FakeDatasetService } from './FakeDatasetService';
import type { SyntheticOutputRow } from '../../models/SyntheticOutput';

const row = (chunkId: string): SyntheticOutputRow => ({
  chunk_id: chunkId,
  document_id: 'd1',
  text: 't',
  summary: 's',
  status: 'completed',
});

describe('FakeDatasetService synthetic rows', () => {
  it('writes and reads back individual synthetic rows', async () => {
    const service = new FakeDatasetService();
    await service.writeSyntheticRow('ds1', 'c1', row('c1'));
    await service.writeSyntheticRow('ds1', 'c2', row('c2'));

    const rows = await service.readSyntheticRows('ds1');
    expect(rows.map((r) => r.chunk_id).sort()).toEqual(['c1', 'c2']);
  });

  it('clears synthetic rows for a dataset', async () => {
    const service = new FakeDatasetService();
    await service.writeSyntheticRow('ds1', 'c1', row('c1'));

    await service.deleteSyntheticRows('ds1');

    expect(await service.readSyntheticRows('ds1')).toEqual([]);
  });
});
