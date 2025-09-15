import { ISupabaseClient, DatabaseResult, DatabaseResults } from '../../types/supabase'

export interface Installation {
  installation_id: number
  provider: 'github'
  user_id: string
  account_login?: string
  account_id?: number
  account_type?: string
  installed_repos_count?: number
  created_at?: string
  updated_at?: string
}

export interface CreateInstallationData extends Omit<Installation, 'created_at' | 'updated_at'> {}
export interface UpdateInstallationData extends Partial<CreateInstallationData> {}

export interface IInstallationService {
  upsertInstallation(data: CreateInstallationData): Promise<DatabaseResult<Installation>>
  getInstallation(installationId: number): Promise<DatabaseResult<Installation>>
  listInstallationsByUser(userId: string): Promise<DatabaseResults<Installation>>
  deleteInstallation(installationId: number): Promise<DatabaseResult<boolean>>
}

export class InstallationService implements IInstallationService {
  constructor(private supabaseClient: ISupabaseClient) {}

  async upsertInstallation(data: CreateInstallationData): Promise<DatabaseResult<Installation>> {
    try {
      const { data: rows, error } = await this.supabaseClient
        .from('installations')
        .upsert(data, { onConflict: 'installation_id' })
        .select()
        .limit(1)

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to upsert installation') }
      }
      const row = Array.isArray(rows) ? rows[0] : rows
      return { data: row, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error') }
    }
  }

  async getInstallation(installationId: number): Promise<DatabaseResult<Installation>> {
    try {
      const { data, error } = await this.supabaseClient
        .from('installations')
        .select('*')
        .eq('installation_id', installationId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return { data: null, error: null }
        return { data: null, error: new Error(error.message || 'Failed to get installation') }
      }
      return { data, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error') }
    }
  }

  async listInstallationsByUser(userId: string): Promise<DatabaseResults<Installation>> {
    try {
      const { data, error, count } = await this.supabaseClient
        .from('installations')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to list installations'), count: 0 }
      }
      return { data: data || [], error: null, count: count || 0 }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error'), count: 0 }
    }
  }

  async deleteInstallation(installationId: number): Promise<DatabaseResult<boolean>> {
    try {
      const { error } = await this.supabaseClient
        .from('installations')
        .delete()
        .eq('installation_id', installationId)

      if (error) {
        return { data: false, error: new Error(error.message || 'Failed to delete installation') }
      }
      return { data: true, error: null }
    } catch (err) {
      return { data: false, error: err instanceof Error ? err : new Error('Unknown error') }
    }
  }
}

export function createInstallationService(supabaseClient: ISupabaseClient): IInstallationService {
  return new InstallationService(supabaseClient)
}

