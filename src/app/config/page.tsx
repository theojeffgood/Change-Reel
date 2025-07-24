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
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');
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
        setEmailRecipients(result.configuration.emailRecipients || []);
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
      setEmailRecipients([]);
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
          emailRecipients: emailRecipients, // Include current emails
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSaveMessage(`✅ Repository "${selectedRepository}" connected successfully! Webhook created and ready to monitor commits.`);
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

  const addEmailRecipient = async () => {
    if (!newEmail || emailRecipients.includes(newEmail)) {
      setEmailError('Please enter a valid email that is not already added.');
      return;
    }

    setSavingEmail(true);
    setEmailMessage('');
    setEmailError('');

    const updatedEmails = [...emailRecipients, newEmail];

    try {
      // Save the updated email list if we have a repository selected
      if (selectedRepository) {
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repositoryFullName: selectedRepository,
            emailRecipients: updatedEmails,
          }),
        });

        const result = await response.json();

        if (response.ok) {
          setEmailRecipients(updatedEmails);
          setNewEmail('');
          setEmailMessage(`✅ Email "${newEmail}" added successfully!`);
        } else {
          setEmailError(result.error || 'Failed to save email');
        }
      } else {
        // If no repository selected yet, just add to local state
        setEmailRecipients(updatedEmails);
        setNewEmail('');
        setEmailMessage(`Email "${newEmail}" added. It will be saved when you select a repository.`);
      }
    } catch (error) {
      console.error('Error adding email:', error);
      setEmailError('An unexpected error occurred while adding email');
    } finally {
      setSavingEmail(false);
    }
  };

  const removeEmailRecipient = async (email: string) => {
    setSavingEmail(true);
    setEmailMessage('');
    setEmailError('');

    const updatedEmails = emailRecipients.filter(e => e !== email);

    try {
      // Save the updated email list if we have a repository selected
      if (selectedRepository) {
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repositoryFullName: selectedRepository,
            emailRecipients: updatedEmails,
          }),
        });

        const result = await response.json();

        if (response.ok) {
          setEmailRecipients(updatedEmails);
          setEmailMessage(`✅ Email "${email}" removed successfully!`);
        } else {
          setEmailError(result.error || 'Failed to remove email');
        }
      } else {
        // If no repository selected yet, just remove from local state
        setEmailRecipients(updatedEmails);
        setEmailMessage(`Email "${email}" removed.`);
      }
    } catch (error) {
      console.error('Error removing email:', error);
      setEmailError('An unexpected error occurred while removing email');
    } finally {
      setSavingEmail(false);
    }
  };

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
        setSaveMessage(`✅ Connection successful! Repository: ${result.repository?.name}, Permissions: ${result.repository?.permissions || 'Unknown'}`);
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
            Connect Your Product
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Connect your development workflow to automatically create beautiful product newsletters that keep everyone informed
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Configuration Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">
                Product Newsletter Setup
              </h2>

              {/* GitHub Connection Status */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Development Platform Connection
                </label>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {githubStatus?.connected ? (
                    /* Connected State */
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                      <div className="flex items-center justify-between p-6">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
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
                                <p className="text-lg font-semibold text-green-800">
                                  Connected Successfully
                                </p>
                                <p className="text-green-600">
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
                          Connect to Start Your Newsletter
                        </h3>
                        <p className="text-gray-600 mb-6">
                          Securely connect to your development platform to automatically track product updates and generate newsletters
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
                              <span className="mr-2">🔗</span>
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
                      Select Your Product
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
                    {selectedRepository && (
                      <div className={`mt-3 p-3 rounded-lg border ${savingRepo ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex items-center space-x-2">
                          {savingRepo && (
                            <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                          )}
                          <p className={`text-sm ${savingRepo ? 'text-yellow-800' : 'text-blue-800'}`}>
                            <span className="font-medium">
                              {savingRepo ? 'Setting up newsletter for:' : 'Newsletter configured for:'}
                            </span> {selectedRepository}
                            {savingRepo && <span className="ml-2">- Connecting to your product updates...</span>}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Email Recipients */}
                  <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Newsletter Recipients 
                      <span className="text-xs text-gray-500 font-normal ml-2">(Optional)</span>
                    </label>
                    <p className="text-sm text-gray-600 mb-4">
                      Add email addresses to receive automatic product update newsletters. You can manage recipients anytime.
                    </p>
                    <div className="space-y-4">
                      <div className="flex space-x-3">
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addEmailRecipient()}
                          placeholder="Enter email address"
                          className="flex-1 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={addEmailRecipient}
                          disabled={savingEmail || !newEmail}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                        >
                          {savingEmail ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              Adding...
                            </>
                          ) : (
                            <>
                              <span className="mr-2">✉️</span>
                              Add Recipient
                            </>
                          )}
                        </button>
                      </div>
                      
                      {emailRecipients.length > 0 && (
                        <div className="space-y-2">
                          {emailRecipients.map((email, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="text-gray-900">{email}</span>
                              <button
                                onClick={() => removeEmailRecipient(email)}
                                disabled={savingEmail}
                                className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                              >
                                {savingEmail ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                    Removing...
                                  </>
                                ) : (
                                  <>
                                    <span className="mr-2">🗑️</span>
                                    Remove
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {emailMessage && (
                        <div className={`mt-3 p-3 rounded-lg ${emailMessage.includes('successfully') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <p className={`text-${emailMessage.includes('successfully') ? 'green' : 'red'}-800`}>{emailMessage}</p>
                        </div>
                      )}
                      {emailError && (
                        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                          <p className="text-red-800">{emailError}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={handleTestConnection}
                      disabled={!selectedRepository || loading}
                      className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 font-medium"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                          Testing...
                        </>
                      ) : (
                        <>
                          <span className="mr-2">🧪</span>
                          Test Connection
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={handleAutoSaveRepository}
                      disabled={!selectedRepository || savingRepo}
                      className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-semibold"
                    >
                      {savingRepo ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Setting Up Newsletter...
                        </>
                      ) : (
                        <>
                          <span className="mr-2">🔄</span>
                          Reconnect Product
                        </>
                      )}
                    </button>
                  </div>

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
                            <span className="mr-2">📊</span>
                            View Newsletter Dashboard →
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

          {/* Documentation Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Quick Setup Guide
              </h3>
              <div className="space-y-6 text-sm text-gray-600">
                <div className="flex space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-xs font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Connect Platform</h4>
                    <p>Securely connect your development platform to enable automatic newsletter generation from product updates.</p>
                    {process.env.NODE_ENV === 'development' && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                        💡 <strong>Dev tip:</strong> OAuth works with localhost:3000 - no ngrok needed! <br />
                        See <code>OAUTH_SETUP.md</code> for development setup.
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-purple-600 text-xs font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Choose Product</h4>
                    <p>Select which product you want to create newsletters for. You&apos;ll track updates automatically.</p>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-xs font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Auto-Setup Complete</h4>
                    <p>Your product newsletter is automatically configured. Updates will be generated instantly when features ship.</p>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-orange-600 text-xs font-bold">4</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Add Recipients (Optional)</h4>
                    <p>Optionally add email addresses to receive newsletter notifications. Perfect for keeping stakeholders informed.</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">What We Access</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></span>
                    Product update notifications
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></span>
                    Automatic newsletter setup
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></span>
                    Email delivery management
                  </li>
                </ul>
              </div>
              
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <h4 className="text-sm font-medium text-green-900 mb-2">🚀 Development Notes</h4>
                  <div className="text-xs text-green-800 space-y-2">
                    <div>
                      <strong>OAuth:</strong> Works with localhost:3000 directly
                    </div>
                    <div>
                      <strong>Webhooks:</strong> Use ngrok only for testing webhooks
                    </div>
                    <div className="text-xs text-green-600">
                      See <code>OAUTH_SETUP.md</code> for complete setup guide
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 