import {
  ISupabaseClient,
  User,
  Project,
  Commit,
  DatabaseResult,
} from '../../types/supabase'

export interface BackupData {
  version: string
  timestamp: string
  users: User[]
  projects: Project[]
  commits: Commit[]
}

export interface IBackupService {
  createBackup(): Promise<DatabaseResult<BackupData>>
  restoreFromBackup(backupData: BackupData): Promise<DatabaseResult<boolean>>
  exportToJson(): Promise<DatabaseResult<string>>
  importFromJson(jsonData: string): Promise<DatabaseResult<boolean>>
  validateBackupData(backupData: BackupData): Promise<DatabaseResult<boolean>>
}

export class BackupService implements IBackupService {
  private readonly BACKUP_VERSION = '1.0.0'

  constructor(private supabaseClient: ISupabaseClient) {}

  async createBackup(): Promise<DatabaseResult<BackupData>> {
    try {
      // Fetch all data from all tables
      const [usersResult, projectsResult, commitsResult] = await Promise.all([
        this.supabaseClient.from('users').select('*'),
        this.supabaseClient.from('projects').select('*'),
        this.supabaseClient.from('commits').select('*'),
      ])

      if (usersResult.error) {
        return { data: null, error: new Error(`Failed to backup users: ${usersResult.error.message}`) }
      }

      if (projectsResult.error) {
        return { data: null, error: new Error(`Failed to backup projects: ${projectsResult.error.message}`) }
      }

      if (commitsResult.error) {
        return { data: null, error: new Error(`Failed to backup commits: ${commitsResult.error.message}`) }
      }

      const backupData: BackupData = {
        version: this.BACKUP_VERSION,
        timestamp: new Date().toISOString(),
        users: usersResult.data || [],
        projects: projectsResult.data || [],
        commits: commitsResult.data || [],
      }

      return { data: backupData, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred during backup'),
      }
    }
  }

  async restoreFromBackup(backupData: BackupData): Promise<DatabaseResult<boolean>> {
    try {
      // Validate backup data first
      const validationResult = await this.validateBackupData(backupData)
      if (validationResult.error) {
        return { data: false, error: validationResult.error }
      }

      // Clear existing data (in reverse order due to foreign key constraints)
      await this.supabaseClient.from('commits').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await this.supabaseClient.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await this.supabaseClient.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      // Insert data in correct order (respecting foreign key constraints)
      if (backupData.users.length > 0) {
        const { error: usersError } = await this.supabaseClient
          .from('users')
          .insert(backupData.users)

        if (usersError) {
          return { data: false, error: new Error(`Failed to restore users: ${usersError.message}`) }
        }
      }

      if (backupData.projects.length > 0) {
        const { error: projectsError } = await this.supabaseClient
          .from('projects')
          .insert(backupData.projects)

        if (projectsError) {
          return { data: false, error: new Error(`Failed to restore projects: ${projectsError.message}`) }
        }
      }

      if (backupData.commits.length > 0) {
        const { error: commitsError } = await this.supabaseClient
          .from('commits')
          .insert(backupData.commits)

        if (commitsError) {
          return { data: false, error: new Error(`Failed to restore commits: ${commitsError.message}`) }
        }
      }

      return { data: true, error: null }
    } catch (err) {
      return {
        data: false,
        error: err instanceof Error ? err : new Error('Unknown error occurred during restore'),
      }
    }
  }

  async exportToJson(): Promise<DatabaseResult<string>> {
    try {
      const backupResult = await this.createBackup()
      if (backupResult.error || !backupResult.data) {
        return { data: null, error: backupResult.error || new Error('Failed to create backup') }
      }

      const jsonString = JSON.stringify(backupResult.data, null, 2)
      return { data: jsonString, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred during export'),
      }
    }
  }

  async importFromJson(jsonData: string): Promise<DatabaseResult<boolean>> {
    try {
      let backupData: BackupData
      try {
        backupData = JSON.parse(jsonData)
      } catch (parseError) {
        return { data: false, error: new Error('Invalid JSON format') }
      }

      return await this.restoreFromBackup(backupData)
    } catch (err) {
      return {
        data: false,
        error: err instanceof Error ? err : new Error('Unknown error occurred during import'),
      }
    }
  }

  async validateBackupData(backupData: BackupData): Promise<DatabaseResult<boolean>> {
    try {
      // Check required fields
      if (!backupData.version) {
        return { data: false, error: new Error('Backup data missing version') }
      }

      if (!backupData.timestamp) {
        return { data: false, error: new Error('Backup data missing timestamp') }
      }

      if (!Array.isArray(backupData.users)) {
        return { data: false, error: new Error('Backup data users must be an array') }
      }

      if (!Array.isArray(backupData.projects)) {
        return { data: false, error: new Error('Backup data projects must be an array') }
      }

      if (!Array.isArray(backupData.commits)) {
        return { data: false, error: new Error('Backup data commits must be an array') }
      }

      // Validate version compatibility
      if (backupData.version !== this.BACKUP_VERSION) {
        return { 
          data: false, 
          error: new Error(`Backup version ${backupData.version} is not compatible with current version ${this.BACKUP_VERSION}`) 
        }
      }

      // Validate timestamp format
      try {
        new Date(backupData.timestamp)
      } catch {
        return { data: false, error: new Error('Invalid timestamp format in backup data') }
      }

      // Basic structure validation for each record type
      for (const user of backupData.users) {
        if (!user.id || !user.email) {
          return { data: false, error: new Error('Invalid user data in backup - missing required fields') }
        }
      }

      for (const project of backupData.projects) {
        if (!project.id || !project.name || !project.provider) {
          return { data: false, error: new Error('Invalid project data in backup - missing required fields') }
        }
      }

      for (const commit of backupData.commits) {
        if (!commit.id || !commit.project_id || !commit.sha || !commit.author) {
          return { data: false, error: new Error('Invalid commit data in backup - missing required fields') }
        }
      }

      return { data: true, error: null }
    } catch (err) {
      return {
        data: false,
        error: err instanceof Error ? err : new Error('Unknown error occurred during validation'),
      }
    }
  }
}

// Factory function for dependency injection
export function createBackupService(supabaseClient: ISupabaseClient): IBackupService {
  return new BackupService(supabaseClient)
} 