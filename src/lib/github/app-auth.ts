import crypto from 'crypto';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function base64UrlEncode(input: Buffer | string): string {
  return (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function normalizePrivateKey(rawKey: string): string {
  // Support keys provided with literal \n sequences
  const maybeMultiline = rawKey.includes('-----BEGIN');
  if (maybeMultiline) return rawKey;
  return rawKey.replace(/\\n/g, '\n');
}

export function createAppJwt(): string {
  const appId = getRequiredEnv('GITHUB_APP_ID');
  const privateKey = normalizePrivateKey(getRequiredEnv('GITHUB_APP_PRIVATE_KEY'));

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // backdate one minute for clock skew
    exp: now + 9 * 60, // 9 minutes (max 10)
    iss: appId,
  };

  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(privateKey);
  const encodedSignature = base64UrlEncode(signature);

  return `${unsigned}.${encodedSignature}`;
}

export interface InstallationAccessToken {
  token: string;
  expiresAt: string;
}

export async function createInstallationAccessToken(installationId: number): Promise<InstallationAccessToken> {
  const jwt = createAppJwt();
  const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'wins-column/1.0.0'
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to create installation token: ${res.status} ${data?.message || ''}`);
  }
  return { token: data.token, expiresAt: data.expires_at };
}

export interface AppInstallation {
  id: number;
  account: { login: string; type?: string };
  repositories_url: string;
  target_type?: string;
  permissions?: Record<string, string>;
}

export async function listAppInstallations(): Promise<AppInstallation[]> {
  const jwt = createAppJwt();
  const res = await fetch('https://api.github.com/app/installations?per_page=100', {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'wins-column/1.0.0'
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list app installations: ${res.status} ${text}`);
  }
  return res.json();
}

export interface InstallationRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
}

export async function listInstallationRepositories(installationId: number): Promise<InstallationRepository[]> {
  const { token } = await createInstallationAccessToken(installationId);
  const res = await fetch('https://api.github.com/installation/repositories?per_page=100', {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'wins-column/1.0.0'
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to list installation repositories: ${res.status} ${data?.message || ''}`);
  }
  return data.repositories || [];
}

// List installations visible to a specific GitHub user (OAuth token required)
export async function listUserInstallations(userAccessToken: string): Promise<AppInstallation[]> {
  const res = await fetch('https://api.github.com/user/installations?per_page=100', {
    headers: {
      Authorization: `token ${userAccessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'wins-column/1.0.0'
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list user installations: ${res.status} ${text}`);
  }
  const data = await res.json();
  // /user/installations returns { total_count, installations: [...] }
  return (data?.installations || []) as AppInstallation[];
}
