import type { AccessCodeRecord } from '../models/AccessCode';

export interface AccessCodeRepository {
  saveCode(record: AccessCodeRecord): Promise<void>;
  getByEmail(email: string): Promise<AccessCodeRecord | null>;
  incrementAttempts(email: string): Promise<void>;
}
