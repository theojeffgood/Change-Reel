import { ISupabaseClient } from '../../types/supabase'

export interface EmailSendRecord {
  id: string
  project_id: string | null
  commit_ids: string[]
  recipients: string[]
  template_type: string
  provider: string
  provider_message_id?: string
  status: string
  error?: string
  created_at: string
}

export interface IEmailTrackingService {
  recordEmailSend(input: Omit<EmailSendRecord, 'id' | 'created_at'>): Promise<{ data: EmailSendRecord | null; error: Error | null }>
  markEmailSendStatus(id: string, status: string, error?: string): Promise<{ data: EmailSendRecord | null; error: Error | null }>
}

export class EmailTrackingService implements IEmailTrackingService {
  constructor(private supabaseClient: ISupabaseClient) {}

  async recordEmailSend(input: Omit<EmailSendRecord, 'id' | 'created_at'>) {
    try {
      const { data, error } = await this.supabaseClient
        .from('email_sends')
        .insert({
          project_id: input.project_id,
          commit_ids: input.commit_ids,
          recipients: input.recipients,
          template_type: input.template_type,
          provider: input.provider,
          provider_message_id: input.provider_message_id,
          status: input.status,
          error: input.error || null,
        })
        .select()
        .single()

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to record email send') }
      }
      return { data: data as EmailSendRecord, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  }

  async markEmailSendStatus(id: string, status: string, error?: string) {
    try {
      const { data, error: dbErr } = await this.supabaseClient
        .from('email_sends')
        .update({ status, error: error || null })
        .eq('id', id)
        .select()
        .single()

      if (dbErr) {
        return { data: null, error: new Error(dbErr.message || 'Failed to update email send status') }
      }
      return { data: data as EmailSendRecord, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  }
}

export function createEmailTrackingService(supabaseClient: ISupabaseClient) {
  return new EmailTrackingService(supabaseClient)
}


