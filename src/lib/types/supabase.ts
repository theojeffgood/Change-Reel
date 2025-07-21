import { SupabaseClient } from '@supabase/supabase-js'

// Database table interfaces based on PRD data models
export interface User {
  id: string
  email: string
  name?: string
  github_id?: string
  access_token?: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  user_id?: string // Optional for MVP - single project configuration
  name: string
  repo_name?: string // GitHub repository name
  provider: string // 'github', 'gitlab', 'bitbucket'
  webhook_url?: string
  webhook_secret?: string // Secret for webhook signature verification
  email_distribution_list: string[] // Array of email addresses
  public_slug?: string // For public changelog URL
  created_at: string
  updated_at: string
}

export interface Commit {
  id: string
  project_id: string
  sha: string
  author: string
  timestamp: string
  summary?: string // AI-generated summary
  type?: 'feature' | 'fix' | 'refactor' | 'chore'
  is_published: boolean
  email_sent: boolean
  created_at: string
  updated_at: string
}

// Configuration interface for Supabase client
export interface SupabaseConfig {
  url: string
  anonKey: string
}

// Simplified Supabase client interface for dependency injection
export interface ISupabaseClient {
  from: (table: string) => any
  auth: any
  storage: any
  rpc: (fn: string, args?: any, options?: any) => any
}

// Service interface for business logic
export interface ISupabaseService {
  getClient: () => ISupabaseClient
  isConnected: () => Promise<boolean>
  testConnection: () => Promise<boolean>
}

// Database query result types
export interface DatabaseResult<T> {
  data: T | null
  error: Error | null
}

export interface DatabaseResults<T> {
  data: T[] | null
  error: Error | null
  count?: number
}

// CRUD operation interfaces
export interface CreateUserData {
  email: string
  name?: string
  github_id?: string
  access_token?: string
}

export interface UpdateUserData {
  email?: string
  name?: string
  github_id?: string
  access_token?: string
}

export interface CreateProjectData {
  name: string
  repo_name?: string
  provider: string
  webhook_url?: string
  webhook_secret?: string
  email_distribution_list?: string[]
  public_slug?: string
  user_id?: string
}

export interface UpdateProjectData {
  name?: string
  repo_name?: string
  provider?: string
  webhook_url?: string
  webhook_secret?: string
  email_distribution_list?: string[]
  public_slug?: string
}

export interface CreateCommitData {
  project_id: string
  sha: string
  author: string
  timestamp: string
  summary?: string
  type?: 'feature' | 'fix' | 'refactor' | 'chore'
  is_published?: boolean
  email_sent?: boolean
}

export interface UpdateCommitData {
  summary?: string
  type?: 'feature' | 'fix' | 'refactor' | 'chore'
  is_published?: boolean
  email_sent?: boolean
}

// Filter and query interfaces
export interface CommitFilter {
  project_id?: string
  author?: string
  type?: 'feature' | 'fix' | 'refactor' | 'chore'
  is_published?: boolean
  email_sent?: boolean
  date_from?: string
  date_to?: string
}

export interface ProjectFilter {
  provider?: string
  user_id?: string
}

// Pagination interface
export interface PaginationOptions {
  page?: number
  limit?: number
  orderBy?: string
  ascending?: boolean
}

// Service interfaces for dependency injection
export interface IUserService {
  getUser(id: string): Promise<User | null>
  createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User>
  updateUser(id: string, updates: Partial<User>): Promise<User | null>
  deleteUser(id: string): Promise<boolean>
}

export interface IProjectService {
  getProject(id: string): Promise<Project | null>
  createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project>
  updateProject(id: string, updates: Partial<Project>): Promise<Project | null>
  deleteProject(id: string): Promise<boolean>
  listProjects(userId?: string): Promise<Project[]>
}

export interface ICommitService {
  getCommit(id: string): Promise<Commit | null>
  createCommit(commit: Omit<Commit, 'id' | 'created_at' | 'updated_at'>): Promise<Commit>
  updateCommit(id: string, updates: Partial<Commit>): Promise<Commit | null>
  deleteCommit(id: string): Promise<boolean>
  listCommits(projectId: string, limit?: number): Promise<Commit[]>
  getUnprocessedCommits(projectId: string): Promise<Commit[]>
  getCommits(projectId: string, limit?: number): Promise<DatabaseResults<Commit>>
  getCommitsByType(projectId: string, type: string, limit?: number): Promise<DatabaseResults<Commit>>
  getCommitsByDateRange(projectId: string, startDate: string, endDate: string): Promise<DatabaseResults<Commit>>
  getCommitsByProjectId(
    projectId: string,
    page: number,
    pageSize: number,
  ): Promise<DatabaseResult<{ commits: Commit[]; count: number }>>
}

export interface IJobService {
  // ... existing code ...
} 