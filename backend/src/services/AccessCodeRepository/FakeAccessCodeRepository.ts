import { createInjectionToken } from '@trackit.io/di-container';
import { AccessCodeRecord } from '../../models/AccessCode';
import type { AccessCodeRepository } from '../../ports/AccessCodeRepository';

export class FakeAccessCodeRepository implements AccessCodeRepository {
  public readonly records = new Map<string, AccessCodeRecord>();

  async saveCode(record: AccessCodeRecord): Promise<void> {
    this.records.set(record.email, { ...record });
  }

  async getByEmail(email: string): Promise<AccessCodeRecord | null> {
    return this.records.get(email) ?? null;
  }

  async incrementAttempts(email: string): Promise<void> {
    const current = this.records.get(email);
    if (!current) {
      return;
    }
    this.records.set(email, {
      ...current,
      attempts: current.attempts + 1,
    });
  }

  async deleteCode(email: string): Promise<void> {
    this.records.delete(email);
  }
}

export const tokenFakeAccessCodeRepository =
  createInjectionToken<FakeAccessCodeRepository>('FakeAccessCodeRepository', {
    useClass: FakeAccessCodeRepository,
  });
