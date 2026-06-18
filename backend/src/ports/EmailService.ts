export interface EmailService {
  sendEmail(email: string, subject: string, body: string): Promise<void>;
}
