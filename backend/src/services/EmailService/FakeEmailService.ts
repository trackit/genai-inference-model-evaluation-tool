import { createInjectionToken } from '@trackit.io/di-container';
import type { EmailService } from '../../ports/EmailService';

export type SentEmail = {
  email: string;
  subject: string;
  body: string;
};

export class FakeEmailService implements EmailService {
  public readonly sentEmails: SentEmail[] = [];

  async sendEmail(email: string, subject: string, body: string): Promise<void> {
    this.sentEmails.push({ email, subject, body });
  }
}

export const tokenFakeEmailService = createInjectionToken<FakeEmailService>(
  'FakeEmailService',
  {
    useClass: FakeEmailService,
  },
);
