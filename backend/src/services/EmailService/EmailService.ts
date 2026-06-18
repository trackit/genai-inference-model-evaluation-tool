import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from '@aws-sdk/client-ses';
import { createInjectionToken, inject } from '@trackit.io/di-container';
import type { EmailService } from '../../ports/EmailService';

export const tokenSESClient = createInjectionToken<SESClient>('SESClient', {
  useClass: SESClient,
});

export class EmailServiceSES implements EmailService {
  private readonly sesClient = inject(tokenSESClient);
  private readonly fromAddress = process.env.SES_FROM_ADDRESS!;

  async sendEmail(email: string, subject: string, body: string): Promise<void> {
    const input: SendEmailCommandInput = {
      Source: this.fromAddress,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: body,
            Charset: 'UTF-8',
          },
        },
      },
    };

    await this.sesClient.send(new SendEmailCommand(input));
  }
}

export const tokenEmailService = createInjectionToken<EmailService>(
  'EmailService',
  {
    useClass: EmailServiceSES,
  },
);
