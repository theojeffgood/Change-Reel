'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

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

// Removed Disconnect flow and dialog

export default function ConfigurationPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [installations, setInstallations] = useState<Array<{ id: number; account?: { login: string } }>>([]);
  const [selectedInstallationId, setSelectedInstallationId] = useState<string>('');
  const [selectedRepository, setSelectedRepository] = useState<string>('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [savingRepo, setSavingRepo] = useState(false);
  const [loading, setLoading] = useState(false);
  // Removed disconnect flow
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isLoadingConfiguration, setIsLoadingConfiguration] = useState(false);
  const [showInstallPicker, setShowInstallPicker] = useState(false);
  const GITHUB_APP_INSTALL_URL = process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL;

  const handleGitHubConnect = async () => {
    if (!GITHUB_APP_INSTALL_URL) return;

    setLoading(true);
    try {
      // Direct redirect to GitHub App installation URL
      window.location.href = GITHUB_APP_INSTALL_URL;
    } catch (error) {
      console.error('Error connecting to GitHub:', error);
      setLoading(false);
    }
  };
  

  // Check GitHub connection status and load existing configuration
  useEffect(() => {
    if (session) {
      checkGitHubStatus();
      fetchInstallations();
      loadExistingConfiguration();
    }
  }, [session]);

  // No-op cleanup; flow handled entirely by GitHub App + NextAuth callback

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

  const fetchInstallations = async () => {
    try {
      const res = await fetch('/api/github/installations');
      const data = await res.json();
      if (res.ok) {
        const installs = data.installations || [];
        setInstallations(installs);
        if (installs.length === 1) {
          const id = String(installs[0].id);
          setSelectedInstallationId(id);
          fetchRepositories(id);
        }
      } else {
        console.error('Failed to load installations', data.error);
      }
    } catch (e) {
      console.error('Error loading installations', e);
    }
  };

  const fetchRepositories = async (installationId: string) => {
    if (!installationId) return;
    setLoadingRepos(true);
    try {
      const res = await fetch(`/api/github/installation-repos?installation_id=${installationId}`);
      const data = await res.json();
      if (res.ok) {
        setRepositories((data.repositories || []) as Repository[]);
      } else {
        console.error('Failed to load repositories', data.error);
        setRepositories([]);
      }
    } catch (e) {
      console.error('Error loading repositories', e);
      setRepositories([]);
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
      }
    } catch (error) {
      console.error('Error loading existing configuration:', error);
    } finally {
      setIsLoadingConfiguration(false);
    }
  };

  // Removed disconnect handler

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
          installationId: Number(selectedInstallationId || 0),
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
          repositoryName: selectedRepository,
          installationId: Number(selectedInstallationId || 0),
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
    <div className="min-h-screen bg-gray-100">
      <SiteHeader />
      
      {/* Disconnect dialog removed */}

      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-8">
            Connect your GitHub
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Connect your development workflow to automatically get notifications when your product changes
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 mb-20">
        <div className="grid grid-cols-1 gap-8">
          {/* Configuration Form - simplified */}
          <div className="lg:col-span-1">

              {/* GitHub Connection Status */}
              <div className="mb-8">
                  {githubStatus?.connected ? (
                    /* Connected State */
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between p-6">
                        <div className="flex items-center space-x-4">
                          {githubStatus.user?.avatar_url && (
                            <img 
                              src={githubStatus.user.avatar_url} 
                              alt="Profile Avatar" 
                              className="w-10 h-10 rounded-full"
                            />
                          )}
                          <div>
                            <div className="flex items-center space-x-3">
                              <p className="text-lg text-black font-semibold">Connected</p>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Active</span>
                            </div>
                            <p className="text-gray-600">
                              {githubStatus.user?.name || githubStatus.user?.login}
                            </p>
                          </div>
                           
                         </div>
                         <button
                           onClick={() => setShowInstallPicker((v) => !v)}
                           disabled={loading || installations.length <= 1}
                           className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                         >
                           Change
                         </button>
                       </div>
                     </div>
                  ) : (
                    /* Disconnected State */
                      <div className="text-center">
                        <div className="inline-flex flex-col items-center space-y-3">
                                                     <button
                             onClick={handleGitHubConnect}
                             disabled={loading || !GITHUB_APP_INSTALL_URL}
                             className="inline-flex items-center mt-6 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold disabled:opacity-50"
                           >
                             {loading ? (
                               <>
                                 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                 Connecting...
                               </>
                             ) : (
                               <>
                                 <svg className="mr-2 w-7 h-10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                   <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.018c0 4.424 2.865 8.176 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.004.071 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.833.091-.647.35-1.088.636-1.339-2.221-.253-4.555-1.112-4.555-4.943 0-1.091.39-1.986 1.029-2.686-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.851.004 1.707.115 2.506.337 1.909-1.296 2.748-1.026 2.748-1.026.546 1.378.202 2.397.099 2.65.64.7 1.028 1.595 1.028 2.686 0 3.841-2.337 4.687-4.565 4.936.359.31.678.923.678 1.861 0 1.343-.012 2.427-.012 2.758 0 .268.18.58.688.481A10.02 10.02 0 0022 12.018C22 6.484 17.523 2 12 2z"/>
                                 </svg>
                                 Connect Your Account
                               </>
                             )}
                           </button>
                           {!GITHUB_APP_INSTALL_URL && (
                             <span className="text-sm text-gray-600 mt-2">Set NEXT_PUBLIC_GITHUB_APP_INSTALL_URL to enable installation</span>
                           )}

                          
                        </div>
                      </div>
                  )}
              </div>

              {githubStatus?.connected && (
                <div>
                  {installations.length === 0 ? (
                    <div className="px-6 pb-6">
                      <div className="p-4 border border-gray-200 rounded-xl bg-white flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Next step</p>
                          <p className="text-sm text-gray-800">Install the Wins Column GitHub App to continue.</p>
                        </div>
                        {GITHUB_APP_INSTALL_URL ? (
                          <a
                            href={GITHUB_APP_INSTALL_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => { try { sessionStorage.setItem('installIntent', '1'); } catch {} }}
                            className="ml-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800"
                          >
                            Install App
                          </a>
                        ) : (
                          <span className="ml-4 text-xs text-gray-500">Set NEXT_PUBLIC_GITHUB_APP_INSTALL_URL</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-8">
                      {showInstallPicker && installations.length > 1 && (
                        <select
                          value={selectedInstallationId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedInstallationId(id);
                            setSelectedRepository('');
                            if (id) fetchRepositories(id);
                            setShowInstallPicker(false);
                          }}
                          className="w-full rounded-xl border-gray-300 focus:border-black focus:ring-black text-gray-900 shadow-sm mb-6"
                        >
                          <option value="">Select an installation...</option>
                          {installations.map((inst) => (
                            <option key={inst.id} value={String(inst.id)}>
                              {inst.account?.login || 'installation'} (ID {inst.id})
                            </option>
                          ))}
                        </select>
                      )}

                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="p-6">
                          <label htmlFor="repository" className="block text-sm font-medium text-gray-700 mb-2">Repository</label>
                          {loadingRepos ? (
                            <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-xl">
                              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-gray-600">Loading repositories...</span>
                            </div>
                          ) : (
                            <select
                              id="repository"
                              value={selectedRepository}
                              onChange={(e) => setSelectedRepository(e.target.value)}
                              className="w-full rounded-lg border-gray-200 focus:border-black focus:ring-2 focus:ring-black text-gray-900 shadow-sm"
                            >
                              <option value="">Select a repository...</option>
                              {repositories.map((repo) => (
                                <option key={repo.id} value={repo.full_name}>
                                  {repo.full_name} {repo.private ? '(Private)' : '(Public)'}
                                </option>
                              ))}
                            </select>
                          )}
                          <p className="mt-2 text-sm text-gray-500">
                            {selectedRepository ? `Selected: ${selectedRepository}` : 'Choose a repository to connect'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <button
                          onClick={() => {
                            if (!selectedRepository) {
                              setSaveError('Please select a repository first.');
                              return;
                            }
                            router.push('/admin');
                          }}
                          className="inline-flex items-center px-6 py-4 text-md font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          See Dashboard →
                        </button>
                      </div>
                    </div>
                  )}

                  {saveMessage && !saveMessage.includes('connected successfully') && (
                    <div className="mt-6 p-4 border border-gray-200 rounded-xl bg-white">
                      <p className="text-gray-800">{saveMessage}</p>
                    </div>
                  )}

                  {saveError && (
                    <div className="mt-6 p-4 border border-gray-200 rounded-xl bg-white">
                      <p className="text-red-700">{saveError}</p>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
} 
