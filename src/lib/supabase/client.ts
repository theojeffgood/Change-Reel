import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { ISupabaseClient, ISupabaseService, SupabaseConfig } from '../types/supabase'
import { UserService } from './services/users'
import { ProjectService } from './services/projects'
import { CommitService } from './services/commits'
import { JobQueueService } from './services/jobs'

/**
 * Validates Supabase configuration from environment variables
 */
export function validateSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
  }

  // Basic URL validation
  try {
    new URL(url)
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not a valid URL')
  }

  return { url, anonKey }
}

/**
 * Creates a configured Supabase client instance
 */
export function createSupabaseClient(config?: SupabaseConfig): SupabaseClient {
  const { url, anonKey } = config || validateSupabaseConfig()
  
  return createClient(url, anonKey, {
    auth: {
      persistSession: false, // Since auth is deferred to post-MVP
      autoRefreshToken: false,
    },
  })
}

/**
 * Supabase service implementation with dependency injection support
 */
export class SupabaseService implements ISupabaseService {
  private client: SupabaseClient
  private config: SupabaseConfig

  public users: UserService
  public projects: ProjectService
  public commits: CommitService
  public jobs: JobQueueService

  constructor(config?: SupabaseConfig) {
    this.config = config || validateSupabaseConfig()
    this.client = createSupabaseClient(this.config)

    this.users = new UserService(this.client)
    this.projects = new ProjectService(this.client)
    this.commits = new CommitService(this.client)
    this.jobs = new JobQueueService(this.client)
  }

  getClient(): ISupabaseClient {
    return {
      from: this.client.from.bind(this.client),
      auth: this.client.auth,
      storage: this.client.storage,
      rpc: this.client.rpc.bind(this.client),
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      // Test connection by attempting a simple query
      const { error } = await this.client
        .from('_supabase_migrations')
        .select('version')
        .limit(1)
        
      return !error
    } catch {
      return false
    }
  }

  async testConnection(): Promise<boolean> {
    // Alias for isConnected to match interface requirement
    return this.isConnected()
  }

  /**
   * Get the raw Supabase client (for internal use)
   */
  getRawClient(): SupabaseClient {
    return this.client
  }
}

// Default singleton instance
let defaultSupabaseService: SupabaseService | null = null

/**
 * Get the default Supabase service instance
 */
export function getSupabaseService(): SupabaseService {
  if (!defaultSupabaseService) {
    defaultSupabaseService = new SupabaseService()
  }
  return defaultSupabaseService
}

/**
 * Create a new Supabase service instance (useful for testing)
 */
export function createSupabaseService(config?: SupabaseConfig): SupabaseService {
  return new SupabaseService(config)
} 