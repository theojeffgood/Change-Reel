'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

interface GitHubStatus {
  connected: boolean;
  user?: {
    id: number;
    login: string;
    name: string;
    avatar_url: string;
    email: string;
  };
  repository?: any;
  error?: string;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
  default_branch: string;
}

export default function ConfigurationPage() {
  const { data: session, status } = useSession();
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<string>('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Check GitHub connection status
  useEffect(() => {
    if (session) {
      checkGitHubStatus();
      fetchRepositories();
    }
  }, [session]);

  const checkGitHubStatus = async () => {
    try {
      const response = await fetch('/api/auth/github/status');
      const data = await response.json();
      setGithubStatus(data);
    } catch (error) {
      console.error('Error checking GitHub status:', error);
      setGithubStatus({ connected: false, error: 'Failed to check status' });
    }
  };

  const fetchRepositories = async () => {
    if (!session?.accessToken) return;
    
    setLoadingRepos(true);
    try {
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      
      if (response.ok) {
        const repos = await response.json();
        if (Array.isArray(repos)) {
          setRepositories(repos.filter((repo: Repository) => !repo.private || repo.name));
        } else {
          console.error('Failed to fetch repositories: response is not an array', repos);
          setRepositories([]);
        }
      } else {
        console.error('Failed to fetch repositories');
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleGitHubConnect = async () => {
    setLoading(true);
    try {
      await signIn('github', { callbackUrl: '/config' });
    } catch (error) {
      console.error('Error connecting to GitHub:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubDisconnect = async () => {
    if (!showDisconnectConfirm) {
      setShowDisconnectConfirm(true);
      return;
    }

    setLoading(true);
    setShowDisconnectConfirm(false);
    try {
      await signOut({ callbackUrl: '/config' });
      setGithubStatus({ connected: false });
      setRepositories([]);
      setSelectedRepository('');
    } catch (error) {
      console.error('Error disconnecting from GitHub:', error);
    } finally {
      setLoading(false);
    }
  };

  const addEmailRecipient = () => {
    if (newEmail && !emailRecipients.includes(newEmail)) {
      setEmailRecipients([...emailRecipients, newEmail]);
      setNewEmail('');
    }
  };

  const removeEmailRecipient = (email: string) => {
    setEmailRecipients(emailRecipients.filter(e => e !== email));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addEmailRecipient();
    }
  };

  const handleSaveConfiguration = async () => {
    if (!selectedRepository || emailRecipients.length === 0) {
      alert('Please select a repository and add at least one email recipient.');
      return;
    }

    setLoading(true);
    try {
      // TODO: Save configuration to database
      console.log('Saving configuration:', {
        repository: selectedRepository,
        emails: emailRecipients,
      });
      alert('Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Failed to save configuration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedRepository) {
      alert('Please select a repository first.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repositoryName: selectedRepository,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const repo = result.repository;
        const webhooks = result.webhookPermissions;
        
        let message = `✅ Connection successful!\n\n`;
        message += `Repository: ${repo.fullName}\n`;
        message += `Type: ${repo.isPrivate ? 'Private' : 'Public'}\n`;
        message += `Permissions: ${repo.permissions.admin ? 'Admin' : repo.permissions.push ? 'Write' : 'Read'}\n`;
        message += `Can create webhooks: ${webhooks.canCreateWebhooks ? 'Yes' : 'No'}\n`;
        
        if (webhooks.webhookUrl) {
          message += `Existing webhook: ${webhooks.webhookUrl}`;
        }
        
        alert(message);
      } else {
        alert(`❌ Connection test failed:\n\n${result.message}\n\n${result.error || ''}`);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      alert('Connection test failed. Please check your network connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckTokenStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/tokens?provider=github');
      const result = await response.json();

      if (result.success) {
        const data = result.data;
        let message = `🔍 Token Status:\n\n`;
        message += `Valid: ${data.isValid ? 'Yes' : 'No'}\n`;
        if (data.expiresAt) {
          message += `Expires: ${new Date(data.expiresAt).toLocaleString()}\n`;
        } else {
          message += `Expires: Never (GitHub tokens don't expire)\n`;
        }
        message += `Should refresh: ${data.shouldRefresh ? 'Yes' : 'No'}\n`;
        if (data.error) {
          message += `\nIssues: ${data.error}`;
        }
        
        alert(message);
      } else {
        alert(`❌ Token status check failed:\n\n${result.error || result.message}`);
      }
    } catch (error) {
      console.error('Error checking token status:', error);
      alert('Token status check failed. Please check your network connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeToken = async () => {
    const confirmed = confirm(
      '⚠️ Are you sure you want to revoke your GitHub token?\n\n' +
      'This will disconnect your GitHub account and you will need to reconnect to continue using Change Reel.'
    );
    
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'revoke',
          provider: 'github',
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ Token revoked successfully!\n\nYour GitHub account has been disconnected. You will need to reconnect to continue using Change Reel.');
        // Refresh the page to update the GitHub status
        setTimeout(() => window.location.reload(), 2000);
      } else {
        alert(`❌ Token revocation failed:\n\n${result.error || result.message}`);
      }
    } catch (error) {
      console.error('Error revoking token:', error);
      alert('Token revocation failed. Please check your network connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Confirmation Dialog Component
  const ConfirmDialog = ({ show, onConfirm, onCancel }: { show: boolean; onConfirm: () => void; onCancel: () => void }) => {
    if (!show) return null;

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Disconnect GitHub Account</h3>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-sm text-gray-600">
                Are you sure you want to disconnect your GitHub account? This will:
              </p>
              <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>Remove access to your repositories</li>
                <li>Stop changelog generation</li>
                <li>Clear your current configuration</li>
              </ul>
              <p className="mt-3 text-sm text-gray-600 font-medium">
                You will need to reconnect and reconfigure to continue using Change Reel.
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Confirmation Dialog */}
        <ConfirmDialog 
          show={showDisconnectConfirm} 
          onConfirm={handleGitHubDisconnect}
          onCancel={() => setShowDisconnectConfirm(false)}
        />

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            Repository Configuration
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Connect your GitHub repository to start generating automatic changelogs
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Configuration Form */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                GitHub Repository Connection
              </h2>

              {/* GitHub Connection Status */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  GitHub Account Connection
                </label>
                <div className="border rounded-lg overflow-hidden">
                  {githubStatus?.connected ? (
                    /* Connected State */
                    <div className="bg-green-50 border-green-200">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full" role="img" aria-label="Connected">
                              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            {githubStatus.user?.avatar_url && (
                              <img
                                src={githubStatus.user.avatar_url}
                                alt={`${githubStatus.user.login}'s GitHub avatar`}
                                className="h-10 w-10 rounded-full ring-2 ring-green-200"
                              />
                            )}
                            <div>
                              <p className="text-sm font-semibold text-green-900">
                                Connected to GitHub
                              </p>
                              <p className="text-sm text-green-700">
                                Signed in as <span className="font-medium">{githubStatus.user?.login}</span>
                              </p>
                              {githubStatus.user?.email && (
                                <p className="text-xs text-green-600">{githubStatus.user.email}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <button
                            onClick={() => setShowDisconnectConfirm(true)}
                            disabled={loading}
                            className="inline-flex items-center px-3 py-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label="Disconnect from GitHub"
                          >
                            {loading ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-green-700" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Disconnecting...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                Disconnect
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Disconnected State */
                    <div className="bg-gray-50 border-gray-200">
                      <div className="flex items-center justify-between p-6">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg" role="img" aria-label="GitHub logo">
                              <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                              </svg>
                            </div>
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              Connect your GitHub account
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Authorize Change Reel to access your GitHub account. We'll look for changes for us to summarize.
                            </p>
                            <div className="mt-3 flex items-center text-xs text-gray-500">
                              <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span>Secure OAuth authentication - no passwords stored</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-4">
                          <button
                            onClick={handleGitHubConnect}
                            disabled={loading}
                            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm hover:shadow-md"
                            aria-label="Connect with GitHub"
                          >
                            {loading ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Connecting to GitHub...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                </svg>
                                Connect with GitHub
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {githubStatus?.error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md" role="alert">
                    <div className="flex">
                      <svg className="w-5 h-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                        <p className="text-sm text-red-700 mt-1">{githubStatus.error}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Repository Selection */}
              {githubStatus?.connected && (
                <div className="mb-8">
                  <label htmlFor="repository" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Repository
                  </label>
                  {loadingRepos ? (
                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-gray-600">Loading repositories...</span>
                    </div>
                  ) : repositories.length > 0 ? (
                    <select
                      id="repository"
                      value={selectedRepository}
                      onChange={(e) => setSelectedRepository(e.target.value)}
                      className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      aria-describedby="repository-description"
                    >
                      <option value="">Choose a repository...</option>
                      {repositories.map((repo) => (
                        <option key={repo.id} value={repo.full_name}>
                          {repo.full_name} {repo.private ? '(Private)' : '(Public)'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 border rounded-lg text-gray-500" role="status">
                      No repositories found. Make sure you have access to repositories with the connected GitHub account.
                    </div>
                  )}
                  {selectedRepository && (
                    <p id="repository-description" className="mt-2 text-sm text-gray-600">
                      Selected: <span className="font-medium">{selectedRepository}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Email Recipients */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Recipients
                </label>
                <div className="space-y-2">
                  <div className="flex">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Enter email address"
                      className="flex-1 rounded-l-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      aria-label="New email recipient"
                    />
                    <button
                      onClick={addEmailRecipient}
                      className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      aria-label="Add email recipient"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-1" role="list" aria-label="Email recipients">
                    {emailRecipients.map((email) => (
                      <div key={email} className="flex items-center justify-between p-2 bg-gray-50 rounded" role="listitem">
                        <span className="text-sm text-gray-700">{email}</span>
                        <button
                          onClick={() => removeEmailRecipient(email)}
                          className="text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-2 py-1"
                          aria-label={`Remove ${email} from recipients`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
                <div className="flex space-x-4">
                  <button
                    onClick={handleSaveConfiguration}
                    disabled={loading || !selectedRepository || emailRecipients.length === 0}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Saving...' : 'Save Configuration'}
                  </button>
                  <button
                    onClick={handleTestConnection}
                    disabled={loading || !selectedRepository}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
            
              </div>
            </div>
          </div>

          {/* Documentation Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg p-6 h-fit">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Setup Guide
              </h3>
              <div className="space-y-4 text-sm text-gray-600">
                <div>
                  <h4 className="font-medium text-gray-900">1. Connect GitHub</h4>
                  <p>Click "Connect with GitHub" to authorize Change Reel to access your repositories.</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">2. Select Repository</h4>
                  <p>Choose the repository you want to monitor for commit changes.</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">3. Add Recipients</h4>
                  <p>Add email addresses to receive changelog notifications.</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">4. Test & Save</h4>
                  <p>Test the connection and save your configuration to start monitoring.</p>
                </div>
              </div>
              
              <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-1">Required Permissions</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Repository access (read commits)</li>
                  <li>• Webhook creation (for real-time updates)</li>
                  <li>• User email (for notifications)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 