import { createInjectionToken, inject } from '@trackit.io/di-container';
import { createHash, randomInt } from 'crypto';
import { BasicError, BasicErrorType } from '../../errors';
import {
  CODE_TTL_MINUTES,
  RESEND_COOLDOWN_SECONDS,
} from '../../models/AccessCode';
import { tokenAccessCodeRepository } from '../../services/AccessCodeRepository/AccessCodeRepository';
import { tokenEmailService } from '../../services/EmailService/EmailService';

export type RequestAccessCodeUseCase = {
  execute(email: string): Promise<void>;
};

export class RequestAccessCodeUseCaseImpl implements RequestAccessCodeUseCase {
  private readonly repository = inject(tokenAccessCodeRepository);
  private readonly emailService = inject(tokenEmailService);

  async execute(email: string): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);
    const existing = await this.repository.getByEmail(normalizedEmail);

    if (
      existing &&
      existing.last_sent_at.getTime() + RESEND_COOLDOWN_SECONDS * 1000 >
        Date.now()
    ) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'RESEND_TOO_SOON',
        `Please wait ${RESEND_COOLDOWN_SECONDS} seconds before requesting a new code`,
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = createHash('sha256').update(code).digest('hex');

    await this.repository.saveCode({
      email: normalizedEmail,
      code_hash: codeHash,
      attempts: 0,
      expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
      last_sent_at: new Date(),
    });

    await this.emailService.sendEmail(
      normalizedEmail,
      'Your verification code',
      `Your verification code is ${code}. This code expires in ${CODE_TTL_MINUTES} minutes.`,
    );
  }

  private normalizeEmail(email: string): string {
    const normalizedEmail = email.trim().toLowerCase();

    if (
      normalizedEmail.length < 3 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      throw new BasicError(
        BasicErrorType.BAD_REQUEST,
        'INVALID_EMAIL',
        'Email must be a valid email address',
      );
    }

    return normalizedEmail;
  }
}

export const tokenRequestAccessCodeUseCase =
  createInjectionToken<RequestAccessCodeUseCase>('RequestAccessCodeUseCase', {
    useClass: RequestAccessCodeUseCaseImpl,
  });
