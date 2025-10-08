export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailMessage {
  to: EmailRecipient[] | string[]; // Resend accepts string or array
  from: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}

export interface SendEmailResponse {
  id: string;
  status: 'queued' | 'sent' | 'rejected';
  provider?: 'resend';
}

export interface IEmailClient {
  sendEmail(message: EmailMessage): Promise<SendEmailResponse>;
}

export interface DigestTemplateData {
  projectName: string;
  commits: Array<{
    summary: string | null;
    author: string | null;
    sha: string;
    timestamp: string;
  }>;
}


