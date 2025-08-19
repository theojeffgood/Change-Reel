'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';

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

interface ConfirmDialogProps {
  show: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ show, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Disconnect GitHub Account</h3>
        <p className="text-gray-600 mb-6">
          Are you sure you want to disconnect your GitHub account? This will remove access to your repositories and disable changelog generation.
        </p>
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConfigurationPage() {
  const { data: session } = useSession();
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<string>('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [savingRepo, setSavingRepo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isLoadingConfiguration, setIsLoadingConfiguration] = useState(false);

  // Check GitHub connection status and load existing configuration
  useEffect(() => {
    if (session) {
      checkGitHubStatus();
      fetchRepositories();
      loadExistingConfiguration();
    }
  }, [session]);

  // Auto-save repository when selected (but not when loading existing config)
  useEffect(() => {
    if (selectedRepository && githubStatus?.connected && !isLoadingConfiguration) {
      handleAutoSaveRepository();
    }
  }, [selectedRepository, githubStatus?.connected, isLoadingConfiguration]);

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

  const loadExistingConfiguration = async () => {
    if (!session) return;

    setIsLoadingConfiguration(true);
    try {
      const response = await fetch('/api/config');
      const result = await response.json();

      if (response.ok && result.configuration) {
        // Set the selected repository without triggering auto-save
        setSelectedRepository(result.configuration.repositoryFullName || '');
        setSaveMessage(`✅ Loaded existing configuration for repository "${result.configuration.repositoryFullName}"`);
      }
    } catch (error) {
      console.error('Error loading existing configuration:', error);
    } finally {
      setIsLoadingConfiguration(false);
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

  const handleAutoSaveRepository = async () => {
    setSavingRepo(true);
    setSaveMessage('');
    setSaveError('');

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repositoryFullName: selectedRepository,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSaveMessage(`Repository "${selectedRepository}" connected successfully!`);
      } else {
        setSaveError(result.error || 'Failed to save repository configuration');
      }
    } catch (error) {
      console.error('Error saving repository configuration:', error);
      setSaveError('An unexpected error occurred while saving repository');
    } finally {
      setSavingRepo(false);
    }
  };

  // Email recipients removed from scope

  const handleTestConnection = async () => {
    if (!selectedRepository) {
      setSaveError('Please select a repository first.');
      return;
    }

    setLoading(true);
    setSaveMessage('');
    setSaveError('');

    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository: selectedRepository,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSaveMessage(`Connection successful! Repository: ${result.repository?.name}, Permissions: ${result.repository?.permissions || 'Unknown'}`);
      } else {
        setSaveError(result.error || 'Connection test failed');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setSaveError('Failed to test connection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Navigation */}
      <nav className="relative px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">⚡</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Wins Column</span>
          </Link>
          <div className="flex items-center space-x-4">
            <Link 
              href="/admin" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Dashboard
            </Link>
            <Link 
              href="/" 
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </nav>
      
      {/* Confirmation Dialog */}
      <ConfirmDialog 
        show={showDisconnectConfirm} 
        onConfirm={handleGitHubDisconnect}
        onCancel={() => setShowDisconnectConfirm(false)}
      />

      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Connect your GitHub
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Connect your development workflow to automatically create summaries of your product updates
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 gap-8">
          {/* Configuration Form - simplified */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">
                Product Summary Setup
              </h2>

              {/* GitHub Connection Status */}
              <div className="mb-8">
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {githubStatus?.connected ? (
                    /* Connected State */
                    <div className="">
                      <div className="flex items-center justify-between p-6">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center">
                              <span className="text-green-600 text-xl">✅</span>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center space-x-3">
                              {githubStatus.user?.avatar_url && (
                                <img 
                                  src={githubStatus.user.avatar_url} 
                                  alt="Profile Avatar" 
                                  className="w-8 h-8 rounded-full"
                                />
                              )}
                              <div>
                                <p className="text-lg font-semibold">
                                  Connected Successfully
                                </p>
                                <p>
                                  {githubStatus.user?.name || githubStatus.user?.login}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                        </div>
                        <button
                          onClick={() => setShowDisconnectConfirm(true)}
                          disabled={loading}
                          className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Disconnected State */
                    <div className="bg-gradient-to-r from-gray-50 to-slate-50 p-6">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-gray-400 text-2xl">🔗</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Connect to Start Your Wins Column
                        </h3>
                        <p className="text-gray-600 mb-6">
                          Securely log-in to your development workflow. We do the rest.
                        </p>
                        <button
                          onClick={handleGitHubConnect}
                          disabled={loading}
                          className="inline-flex items-center px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 font-semibold"
                        >
                          {loading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              Connecting...
                            </>
                          ) : (
                            <>
                              <svg className="mr-2 w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.018c0 4.424 2.865 8.176 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.004.071 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.833.091-.647.35-1.088.636-1.339-2.221-.253-4.555-1.112-4.555-4.943 0-1.091.39-1.986 1.029-2.686-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.851.004 1.707.115 2.506.337 1.909-1.296 2.748-1.026 2.748-1.026.546 1.378.202 2.397.099 2.65.64.7 1.028 1.595 1.028 2.686 0 3.841-2.337 4.687-4.565 4.936.359.31.678.923.678 1.861 0 1.343-.012 2.427-.012 2.758 0 .268.18.58.688.481A10.02 10.02 0 0022 12.018C22 6.484 17.523 2 12 2z"/>
                              </svg>
                              Connect Your Account
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {githubStatus?.connected && (
                <>
                  {/* Repository Selection */}
                  <div className="mb-8">
                    <label htmlFor="repository" className="block text-sm font-medium text-gray-700 mb-4">
                      Choose Your Product
                    </label>
                    {loadingRepos ? (
                      <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-xl">
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-gray-600">Loading your products...</span>
                      </div>
                    ) : repositories.length > 0 ? (
                      <select
                        id="repository"
                        value={selectedRepository}
                        onChange={(e) => setSelectedRepository(e.target.value)}
                        className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-gray-900 shadow-sm"
                      >
                        <option value="">Choose a product to track...</option>
                        {repositories.map((repo) => (
                          <option key={repo.id} value={repo.full_name}>
                            {repo.full_name} {repo.private ? '(Private)' : '(Public)'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-4 border border-gray-200 rounded-xl text-gray-500">
                        No products found. Make sure you have access to repositories with the connected account.
                      </div>
                    )}
                  </div>

                  {/* Email recipients removed from scope */}

                  {/* Status Messages */}
                  {saveMessage && (
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800">{saveMessage}</p>
                      {saveMessage.includes('successfully') && (
                        <div className="mt-3">
                          <Link 
                            href="/admin" 
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            View Dashboard →
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {saveError && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-800">{saveError}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {/* Removed documentation sidebar and dev-only helper content for a simpler, user-facing page */}
        </div>
      </div>
    </div>
  );
} 