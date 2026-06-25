import { createInjectionToken, inject } from '@trackit.io/di-container';
import { createHash } from 'crypto';
import { BasicError, BasicErrorType } from '../../errors';
import { MAX_CODE_ATTEMPTS } from '../../models/AccessCode';
import { tokenAccessCodeRepository } from '../../services/AccessCodeRepository/AccessCodeRepository';

export type VerifyAccessCodeResult = {
  expiresAt: Date;
};

export type VerifyAccessCodeUseCase = {
  verify(email: string, code: string): Promise<VerifyAccessCodeResult>;
};

export class VerifyAccessCodeUseCaseImpl implements VerifyAccessCodeUseCase {
  private readonly repository = inject(tokenAccessCodeRepository);

  async verify(email: string, code: string): Promise<VerifyAccessCodeResult> {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedCode = this.normalizeCode(code);
    const record = await this.repository.getByEmail(normalizedEmail);

    if (!record) {
      this.throwInvalidCode();
    }

    if (record.expires_at.getTime() < Date.now()) {
      this.throwInvalidCode();
    }

    if (record.attempts >= MAX_CODE_ATTEMPTS) {
      throw new BasicError(
        BasicErrorType.FORBIDDEN,
        'CODE_LOCKED',
        'Verification code is locked. Request a new code',
      );
    }

    const providedHash = createHash('sha256')
      .update(normalizedCode)
      .digest('hex');
    if (providedHash !== record.code_hash) {
      await this.repository.incrementAttempts(normalizedEmail);
      this.throwInvalidCode();
    }

    return { expiresAt: record.expires_at };
  }

  private normalizeEmail(email: string): string {
    const normalizedEmail = email.trim().toLowerCase();
    if (
      normalizedEmail.length < 3 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      this.throwInvalidCode();
    }
    return normalizedEmail;
  }

  private normalizeCode(code: string): string {
    const normalizedCode = code.trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      this.throwInvalidCode();
    }
    return normalizedCode;
  }

  private throwInvalidCode(): never {
    throw new BasicError(
      BasicErrorType.FORBIDDEN,
      'INVALID_CODE',
      'Verification code is invalid or expired',
    );
  }
}

export const tokenVerifyAccessCodeUseCase =
  createInjectionToken<VerifyAccessCodeUseCase>('VerifyAccessCodeUseCase', {
    useClass: VerifyAccessCodeUseCaseImpl,
  });
