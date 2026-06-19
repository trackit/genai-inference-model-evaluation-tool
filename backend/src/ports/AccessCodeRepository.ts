import type { AccessCodeRecord } from '../models/AccessCode';

export interface AccessCodeRepository {
  deleteCode(email: string): Promise<void>;
  saveCode(record: AccessCodeRecord): Promise<void>;
  getByEmail(email: string): Promise<AccessCodeRecord | null>;
  incrementAttempts(email: string): Promise<void>;
}
