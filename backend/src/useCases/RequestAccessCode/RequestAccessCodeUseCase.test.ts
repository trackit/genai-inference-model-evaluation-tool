import { inject, reset } from '@trackit.io/di-container';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RESEND_COOLDOWN_SECONDS } from '../../models/AccessCode';
import { AccessCodeMother } from '../../models/AccessCodeMother';
import { tokenFakeAccessCodeRepository } from '../../services/AccessCodeRepository/FakeAccessCodeRepository';
import { tokenFakeEmailService } from '../../services/EmailService/FakeEmailService';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { tokenRequestAccessCodeUseCase } from './RequestAccessCodeUseCase';

describe('RequestAccessCodeUseCase', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe('execute', () => {
    it('should create a hashed code and send email', async () => {
      const { useCase, emailService, accessCodeRepository } = setup();

      await useCase.execute('Test@Example.Com');

      expect(emailService.sentEmails).toHaveLength(1);
      const sent = emailService.sentEmails[0];
      expect(sent.email).toBe('test@example.com');
      expect(sent.subject).toBe('Your verification code');
      const code = sent.body.match(/\d{6}/)?.[0];
      expect(code).toMatch(/^\d{6}$/);

      const savedRecord =
        await accessCodeRepository.getByEmail('test@example.com');
      expect(savedRecord).not.toBeNull();
      expect(savedRecord?.code_hash).not.toBe(code);
      expect(savedRecord?.attempts).toBe(0);
      expect(savedRecord?.expires_at.getTime()).toBeGreaterThan(
        savedRecord!.last_sent_at.getTime(),
      );
    });

    it('should delete saved code when email delivery fails', async () => {
      const { useCase, emailService, accessCodeRepository } = setup();
      vi.spyOn(emailService, 'sendEmail').mockRejectedValueOnce(
        new Error('SES failed'),
      );

      await expect(useCase.execute('user@example.com')).rejects.toThrow(
        'SES failed',
      );
      expect(
        await accessCodeRepository.getByEmail('user@example.com'),
      ).toBeNull();
    });
  });

  describe('validation', () => {
    it('should reject invalid email addresses', async () => {
      const { useCase } = setup();

      await expect(useCase.execute('invalid')).rejects.toThrow(
        'Email must be a valid email address',
      );
    });
  });

  it('should enforce resend cooldown', async () => {
    const { useCase, accessCodeRepository } = setup();
    const now = new Date('2026-01-01T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const accessCode = AccessCodeMother.basic()
      .withEmail('user@example.com')
      .withLastSentAt(now)
      .build();
    await accessCodeRepository.saveCode(accessCode);

    await expect(useCase.execute('user@example.com')).rejects.toThrow(
      `Please wait ${RESEND_COOLDOWN_SECONDS} seconds before requesting a new code`,
    );
  });
});

const setup = () => {
  reset();
  registerTestInfrastructure();

  return {
    useCase: inject(tokenRequestAccessCodeUseCase),
    accessCodeRepository: inject(tokenFakeAccessCodeRepository),
    emailService: inject(tokenFakeEmailService),
  };
};
