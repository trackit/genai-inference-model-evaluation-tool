import { createHash } from 'crypto';
import { AccessCodeRecord } from './AccessCode';

export class AccessCodeMother {
  private data: AccessCodeRecord;
  private constructor(data: AccessCodeRecord) {
    this.data = data;
  }
  public static basic(): AccessCodeMother {
    return new AccessCodeMother({
      email: 'test@example.com',
      code_hash: '123456',
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
      attempts: 0,
      last_sent_at: new Date(),
    });
  }

  public withEmail(email: string): AccessCodeMother {
    this.data.email = email;
    return this;
  }

  public withCodeHash(code_hash: string): AccessCodeMother {
    this.data.code_hash = code_hash;
    return this;
  }

  public withCode(code: string): AccessCodeMother {
    this.data.code_hash = createHash('sha256').update(code).digest('hex');
    return this;
  }

  public withExpiresAt(expires_at: Date): AccessCodeMother {
    this.data.expires_at = expires_at;
    return this;
  }

  public withAttempts(attempts: number): AccessCodeMother {
    this.data.attempts = attempts;
    return this;
  }

  public withLastSentAt(last_sent_at: Date): AccessCodeMother {
    this.data.last_sent_at = last_sent_at;
    return this;
  }

  public build(): AccessCodeRecord {
    return this.data;
  }
}
