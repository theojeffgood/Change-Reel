import {
  ISupabaseClient,
  User,
  CreateUserData,
  UpdateUserData,
  DatabaseResult,
  DatabaseResults,
} from '../../types/supabase'

export interface IUserService {
  getUser(id: string): Promise<DatabaseResult<User>>
  getUserByEmail(email: string): Promise<DatabaseResult<User>>
  createUser(data: CreateUserData): Promise<DatabaseResult<User>>
  updateUser(id: string, data: UpdateUserData): Promise<DatabaseResult<User>>
  deleteUser(id: string): Promise<DatabaseResult<boolean>>
  listUsers(limit?: number, offset?: number): Promise<DatabaseResults<User>>
}

export class UserService implements IUserService {
  constructor(private supabaseClient: ISupabaseClient) {}

  async getUser(id: string): Promise<DatabaseResult<User>> {
    try {
      const { data, error } = await this.supabaseClient
        .from('users')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get user') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async getUserByEmail(email: string): Promise<DatabaseResult<User>> {
    try {
      const { data, error } = await this.supabaseClient
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to get user by email') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async createUser(userData: CreateUserData): Promise<DatabaseResult<User>> {
    try {
      // Validate required fields
      if (!userData.email) {
        return { data: null, error: new Error('Email is required') }
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(userData.email)) {
        return { data: null, error: new Error('Invalid email format') }
      }

      const { data, error } = await this.supabaseClient
        .from('users')
        .insert(userData)
        .select()

      // Handle the case where insert succeeds but returns array
      const insertedUser = Array.isArray(data) && data.length > 0 ? data[0] : data;

      if (error) {
        // Handle unique constraint violations
        if (error.code === '23505') {
          return { data: null, error: new Error('User with this email already exists') }
        }
        return { data: null, error: new Error(error.message || 'Failed to create user') }
      }

      return { data: insertedUser, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async updateUser(id: string, userData: UpdateUserData): Promise<DatabaseResult<User>> {
    try {
      // Validate email if provided
      if (userData.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(userData.email)) {
          return { data: null, error: new Error('Invalid email format') }
        }
      }

      const { data, error } = await this.supabaseClient
        .from('users')
        .update(userData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          return { data: null, error: new Error('User with this email already exists') }
        }
        return { data: null, error: new Error(error.message || 'Failed to update user') }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async deleteUser(id: string): Promise<DatabaseResult<boolean>> {
    try {
      const { error } = await this.supabaseClient
        .from('users')
        .delete()
        .eq('id', id)

      if (error) {
        return { data: false, error: new Error(error.message || 'Failed to delete user') }
      }

      return { data: true, error: null }
    } catch (err) {
      return {
        data: false,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
      }
    }
  }

  async listUsers(limit = 50, offset = 0): Promise<DatabaseResults<User>> {
    try {
      const query = this.supabaseClient
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to list users'), count: 0 }
      }

      return { data: data || [], error: null, count: count || 0 }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error occurred'),
        count: 0,
      }
    }
  }
}

// Factory function for dependency injection
export function createUserService(supabaseClient: ISupabaseClient): IUserService {
  return new UserService(supabaseClient)
} 