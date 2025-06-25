// Import specific interfaces and classes
import { ISupabaseClient } from '../../types/supabase'
import { UserService, createUserService } from './users'
import type { IUserService } from './users'
import { ProjectService, createProjectService } from './projects'
import type { IProjectService } from './projects'
import { CommitService, createCommitService } from './commits'
import type { ICommitService } from './commits'

// Re-export types for convenience
export * from '../../types/supabase'

// Re-export service classes and interfaces
export { UserService, createUserService }
export type { IUserService }
export { ProjectService, createProjectService }
export type { IProjectService }
export { CommitService, createCommitService }
export type { ICommitService }

// Service container interface
export interface ISupabaseServices {
  users: IUserService
  projects: IProjectService
  commits: ICommitService
}

// Factory function to create all services with dependency injection
export function createSupabaseServices(supabaseClient: ISupabaseClient): ISupabaseServices {
  return {
    users: createUserService(supabaseClient),
    projects: createProjectService(supabaseClient),
    commits: createCommitService(supabaseClient),
  }
}

// Service provider class for better encapsulation
export class SupabaseServiceProvider {
  private services: ISupabaseServices

  constructor(supabaseClient: ISupabaseClient) {
    this.services = createSupabaseServices(supabaseClient)
  }

  get users(): IUserService {
    return this.services.users
  }

  get projects(): IProjectService {
    return this.services.projects
  }

  get commits(): ICommitService {
    return this.services.commits
  }

  // Get all services (useful for testing)
  getAllServices(): ISupabaseServices {
    return this.services
  }
} 