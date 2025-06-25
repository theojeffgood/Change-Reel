/**
 * OAuth Validation Service for GitHub Integration
 * 
 * This service handles validation for OAuth-based GitHub integration,
 * removing the need for manual token validation while maintaining
 * robust validation for repository URLs, email addresses, and OAuth parameters.
 */

// Email validation regex (RFC 5322 compliant)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// GitHub repository URL patterns
const GITHUB_REPO_PATTERNS = [
  /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/,
  /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/  // owner/repo format
];

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface OAuthConfig {
  repositoryUrl?: string;
  repositoryFullName?: string;
  emailRecipients: string[];
  webhookSecret?: string; // Optional since it's auto-generated in OAuth flow
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

/**
 * Validates a GitHub repository URL or full name
 */
export function validateRepositoryIdentifier(identifier: string): ValidationResult {
  const errors: string[] = [];
  
  if (!identifier || identifier.trim().length === 0) {
    errors.push('Repository identifier is required');
    return { isValid: false, errors };
  }

  const trimmed = identifier.trim();
  
  // Check against GitHub URL patterns
  const isValidPattern = GITHUB_REPO_PATTERNS.some(pattern => pattern.test(trimmed));
  
  if (!isValidPattern) {
    errors.push('Invalid repository format. Use either "owner/repo" or full GitHub URL');
  }

  // Additional validation for URL format
  if (trimmed.includes('github.com')) {
    try {
      const url = new URL(trimmed);
      if (url.hostname !== 'github.com') {
        errors.push('Only GitHub.com repositories are supported');
      }
      
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      if (pathParts.length !== 2) {
        errors.push('GitHub URL must point to a repository (github.com/owner/repo)');
      }
    } catch {
      errors.push('Invalid URL format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates a single email address
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (!email || email.trim().length === 0) {
    errors.push('Email address is required');
    return { isValid: false, errors };
  }

  const trimmed = email.trim().toLowerCase();
  
  // Length validation
  if (trimmed.length > 320) { // RFC 5321 limit
    errors.push('Email address is too long (maximum 320 characters)');
  }

  // Format validation
  if (!EMAIL_REGEX.test(trimmed)) {
    errors.push('Invalid email address format');
  }

  // Basic domain validation
  const domainPart = trimmed.split('@')[1];
  if (domainPart && (domainPart.length > 253 || domainPart.startsWith('.') || domainPart.endsWith('.'))) {
    errors.push('Invalid email domain');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates a list of email recipients
 */
export function validateEmailRecipients(emails: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!emails || emails.length === 0) {
    errors.push('At least one email recipient is required');
    return { isValid: false, errors };
  }

  // Check for duplicates
  const uniqueEmails = new Set<string>();
  const duplicates = new Set<string>();
  
  emails.forEach(email => {
    const normalized = email.trim().toLowerCase();
    if (uniqueEmails.has(normalized)) {
      duplicates.add(email);
    }
    uniqueEmails.add(normalized);
  });

  if (duplicates.size > 0) {
    errors.push(`Duplicate email addresses found: ${Array.from(duplicates).join(', ')}`);
  }

  // Validate each email
  emails.forEach((email, index) => {
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      errors.push(`Email ${index + 1}: ${emailValidation.errors.join(', ')}`);
    }
  });

  // Warnings for large recipient lists
  if (emails.length > 10) {
    warnings.push('Large number of recipients may affect email delivery performance');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates OAuth session data
 */
export function validateOAuthSession(session: any): ValidationResult {
  const errors: string[] = [];
  
  if (!session) {
    errors.push('OAuth session is required');
    return { isValid: false, errors };
  }

  if (!session.user) {
    errors.push('OAuth session must include user information');
  }

  if (!session.accessToken) {
    errors.push('OAuth session must include access token');
  }

  // Validate GitHub-specific session data
  if (session.user && !session.user.email) {
    errors.push('GitHub OAuth session must include user email');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates GitHub repository permissions for webhook creation
 */
export function validateRepositoryPermissions(repository: GitHubRepository): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!repository.permissions) {
    warnings.push('Repository permissions not available - webhook creation may fail');
    return { isValid: true, errors, warnings };
  }

  // Check for admin or push permissions (needed for webhook creation)
  if (!repository.permissions.admin && !repository.permissions.push) {
    errors.push('Insufficient permissions to create webhooks. Admin or push access required.');
  }

  // Warning for private repositories
  if (repository.private && !repository.permissions.admin) {
    warnings.push('Private repository detected. Ensure you have proper access rights.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates complete OAuth configuration
 */
export function validateOAuthConfiguration(config: OAuthConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate repository identifier
  if (config.repositoryUrl || config.repositoryFullName) {
    const repoIdentifier = config.repositoryUrl || config.repositoryFullName || '';
    const repoValidation = validateRepositoryIdentifier(repoIdentifier);
    if (!repoValidation.isValid) {
      errors.push(...repoValidation.errors);
    }
    if (repoValidation.warnings) {
      warnings.push(...repoValidation.warnings);
    }
  } else {
    errors.push('Repository selection is required');
  }

  // Validate email recipients
  const emailValidation = validateEmailRecipients(config.emailRecipients);
  if (!emailValidation.isValid) {
    errors.push(...emailValidation.errors);
  }
  if (emailValidation.warnings) {
    warnings.push(...emailValidation.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Extracts repository owner and name from various formats
 */
export function extractRepositoryInfo(identifier: string): { owner: string; repo: string } | null {
  const trimmed = identifier.trim();
  
  // Handle GitHub URL format
  if (trimmed.includes('github.com')) {
    try {
      const url = new URL(trimmed);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      if (pathParts.length >= 2) {
        return {
          owner: pathParts[0],
          repo: pathParts[1]
        };
      }
    } catch {
      // Fall through to owner/repo format
    }
  }
  
  // Handle owner/repo format
  const parts = trimmed.split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return {
      owner: parts[0],
      repo: parts[1]
    };
  }
  
  return null;
}

/**
 * Creates a normalized configuration object from form data
 */
export function normalizeOAuthConfig(formData: {
  repositoryUrl?: string;
  repositoryFullName?: string;
  emailRecipients: string[];
}): OAuthConfig {
  return {
    repositoryUrl: formData.repositoryUrl?.trim(),
    repositoryFullName: formData.repositoryFullName?.trim(),
    emailRecipients: formData.emailRecipients.map(email => email.trim().toLowerCase()),
  };
} 