import { inject, reset } from '@trackit.io/di-container';
import { describe, expect, it, vi } from 'vitest';
import { MAX_CODE_ATTEMPTS } from '../../models/AccessCode';
import { AccessCodeMother } from '../../models/AccessCodeMother';
import { tokenFakeAccessCodeRepository } from '../../services/AccessCodeRepository/FakeAccessCodeRepository';
import { registerTestInfrastructure } from '../../test/registerTestInfrastructure';
import { tokenVerifyAccessCodeUseCase } from './VerifyAccessCodeUseCase';

describe('VerifyAccessCodeUseCase', () => {
  it('should accept valid code for email', async () => {
    const { useCase, accessCodeRepository } = setup();

    const accessCode = AccessCodeMother.basic()
      .withEmail('user@example.com')
      .withCode('123456')
      .build();
    await accessCodeRepository.saveCode(accessCode);

    await expect(useCase.verify('user@example.com', '123456')).resolves.toBe(
      undefined,
    );
  });

  it('should reject expired code', async () => {
    const { useCase, accessCodeRepository } = setup();

    const accessCode = AccessCodeMother.basic()
      .withEmail('user@example.com')
      .withCode('123456')
      .withExpiresAt(new Date(Date.now() - 1000))
      .build();
    await accessCodeRepository.saveCode(accessCode);

    await expect(useCase.verify('user@example.com', '123456')).rejects.toThrow(
      'Verification code is invalid or expired',
    );
  });

  it('should increment attempts and reject wrong code', async () => {
    const { useCase, accessCodeRepository } = setup();
    const accessCode = AccessCodeMother.basic()
      .withEmail('user@example.com')
      .withCode('123456')
      .build();
    await accessCodeRepository.saveCode(accessCode);

    await expect(useCase.verify('user@example.com', '999999')).rejects.toThrow(
      'Verification code is invalid or expired',
    );

    const updatedRecord =
      await accessCodeRepository.getByEmail('user@example.com');
    expect(updatedRecord?.attempts).toBe(1);
  });

  it('should reject when code is already locked', async () => {
    const { useCase, accessCodeRepository } = setup();
    const accessCode = AccessCodeMother.basic()
      .withEmail('user@example.com')
      .withCode('123456')
      .withAttempts(MAX_CODE_ATTEMPTS)
      .build();
    await accessCodeRepository.saveCode(accessCode);

    await expect(useCase.verify('user@example.com', '123456')).rejects.toThrow(
      'Verification code is locked. Request a new code',
    );
  });
});

const setup = () => {
  reset();
  vi.useRealTimers();
  registerTestInfrastructure();
  return {
    useCase: inject(tokenVerifyAccessCodeUseCase),
    accessCodeRepository: inject(tokenFakeAccessCodeRepository),
  };
};
