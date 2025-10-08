import { IEmailClient, EmailMessage, SendEmailResponse } from './types'

export interface ResendClientConfig {
  apiKey?: string
  apiBaseUrl?: string
}

export class ResendEmailClient implements IEmailClient {
  private apiKey: string
  private apiBaseUrl: string

  constructor(config?: ResendClientConfig) {
    const key = config?.apiKey || process.env.RESEND_API_KEY
    if (!key) {
      throw new Error('RESEND_API_KEY environment variable is required')
    }
    this.apiKey = key
    this.apiBaseUrl = config?.apiBaseUrl || 'https://api.resend.com'
  }

  async sendEmail(message: EmailMessage): Promise<SendEmailResponse> {
    const url = `${this.apiBaseUrl}/emails`
    const payload: Record<string, any> = {
      to: Array.isArray(message.to) ? message.to : [message.to],
      from: message.from,
      subject: message.subject,
      html: message.html,
      headers: message.headers || {},
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const errMsg = text || `Resend API error: ${res.status}`
      throw new Error(errMsg)
    }

    const json = await res.json()
    return {
      id: json?.id || 'unknown',
      status: 'queued',
      provider: 'resend',
    }
  }
}

export function createResendClient(config?: ResendClientConfig): ResendEmailClient {
  return new ResendEmailClient(config)
}


