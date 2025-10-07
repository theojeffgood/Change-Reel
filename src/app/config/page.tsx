'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useSession, signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
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
  repository?: Record<string, unknown> | null;
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
  return (
    <Suspense fallback={null}>
      <ConfigurationPageContent />
    </Suspense>
  );
}

function ConfigurationPageContent() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoFullNames, setSelectedRepoFullNames] = useState<string[]>([]);
  const [installations, setInstallations] = useState<Array<{ id: number; account?: { login: string } }>>([]);
  const [selectedInstallationId, setSelectedInstallationId] = useState<string>('');
  const [selectedRepository, setSelectedRepository] = useState<string>('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isLoadingConfiguration, setIsLoadingConfiguration] = useState(false);
  const [configurationLoaded, setConfigurationLoaded] = useState(false);
  const [hasExistingConfiguration, setHasExistingConfiguration] = useState(false);
  const [installationError, setInstallationError] = useState('');
  const [saving, setSaving] = useState(false);
  const [installationsLoaded, setInstallationsLoaded] = useState(false);
  const [githubStatusLoading, setGithubStatusLoading] = useState(true);
  const shouldRedirect = ['1', 'true'].includes((searchParams?.get('redirect') || '').toLowerCase());
  const authError = searchParams?.get('error');
  const hasRedirectedRef = useRef(false);
  const lastSavedRef = useRef<{ repo: string; installation: string } | null>(null);
  const savingRef = useRef(false);
  const [showInstallPicker, setShowInstallPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [repoError, setRepoError] = useState('');

  const handleReauthenticate = () => {
    hasRedirectedRef.current = true;
    void signIn('github', { callbackUrl: '/config' });
  };

  // const hasConfiguredRepo = hasExistingConfiguration || Boolean(selectedRepository);
  // const headerHasActiveConfiguration = hasExistingConfiguration && Boolean(selectedInstallationId && selectedInstallationId !== '0');

  // const handleGitHubConnect = async () => {
  //   if (!GITHUB_APP_INSTALL_URL) return;

  //   setLoading(true);
  //   try {
  //     // Direct redirect to GitHub App installation URL
  //     window.location.href = GITHUB_APP_INSTALL_URL;
  //   } catch (error) {
  //     console.error('Error connecting to GitHub:', error);
  //     setLoading(false);
  //   }
  // };

  const checkGitHubStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/github/status');
      const data = await response.json();
      setGithubStatus(data);
    } catch (error) {
      console.error('Error checking GitHub status:', error);
      setGithubStatus({ connected: false, error: 'Failed to check status' });
    } finally {
      setGithubStatusLoading(false);
    }
  }, []);

  const fetchInstallations = useCallback(async () => {
    setInstallationsLoaded(false);
    try {
      const res = await fetch('/api/github/installations');
      const data = await res.json();
      if (res.ok) {
        const installs = data.installations || [];
        setInstallations(installs);
        setInstallationError(data.tokenError || '');
      } else {
        console.error('Failed to load installations', data.error);
        setInstallationError(data.error || 'Failed to load installations');
      }
    } catch (e) {
      console.error('Error loading installations', e);
      setInstallationError('Failed to load installations');
    } finally {
      setInstallationsLoaded(true);
    }
  }, []);

  const fetchRepositories = useCallback(async (installationId: string) => {
    if (!installationId) return;
    setLoadingRepos(true);
    try {
      const res = await fetch(`/api/github/installation-repos?installation_id=${installationId}`);
      const data = await res.json();
      if (res.ok) {
        const reposList = (data.repositories || []) as Repository[];
        setRepositories(reposList);
        try {
          // Initialize selection from tracked projects in DB
          const trackedRes = await fetch('/api/projects');
          if (trackedRes.ok) {
            const trackedJson = await trackedRes.json();
            const trackedNames: string[] = Array.isArray(trackedJson?.projects)
              ? trackedJson.projects.map((p: any) => p.repo_name || p.name).filter(Boolean)
              : [];
            const repoFullNames = new Set(reposList.map(r => r.full_name));
            const initialSelection = trackedNames.filter(n => repoFullNames.has(n));
            setSelectedRepoFullNames(initialSelection);
          } else {
            setSelectedRepoFullNames([]);
          }
        } catch {
          setSelectedRepoFullNames([]);
        }
      } else {
        console.error('Failed to load repositories', data.error);
        setRepositories([]);
        setSelectedRepoFullNames([]);
        setRepoError('Failed to load repositories');
      }
    } catch (e) {
      console.error('Error loading repositories', e);
      setRepositories([]);
      setSelectedRepoFullNames([]);
      setRepoError('Failed to load repositories');
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    if (installations.length !== 1) return;
    if (selectedInstallationId && selectedInstallationId !== '0') return;

    const id = String(installations[0].id);
    setSelectedInstallationId(id);
    void fetchRepositories(id);
  }, [installations, selectedInstallationId, fetchRepositories]);

  const loadExistingConfiguration = useCallback(async () => {
    if (!session) return;

    setIsLoadingConfiguration(true);
    setConfigurationLoaded(false);
    try {
      const response = await fetch('/api/config');
      const result = await response.json();

      if (response.ok && result.configuration) {
        setHasExistingConfiguration(true);
        const repoName = result.configuration.repositoryFullName || '';
        const installationId = result.configuration.installationId;

        setSelectedRepository(repoName);

        if (installationId) {
          const idString = String(installationId);
          setSelectedInstallationId(idString);
          void fetchRepositories(idString);
          lastSavedRef.current = repoName
            ? { repo: repoName, installation: idString }
            : null;
        } else {
          setSelectedInstallationId('');
        }
      } else {
        setHasExistingConfiguration(false);
      }
    } catch (error) {
      console.error('Error loading existing configuration:', error);
      setHasExistingConfiguration(false);
    } finally {
      setIsLoadingConfiguration(false);
      setConfigurationLoaded(true);
    }
  }, [session, fetchRepositories]);

  // Kick off initial data loading once session state is known
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      void checkGitHubStatus();
      void fetchInstallations();
      void loadExistingConfiguration();
    } else if (sessionStatus === 'unauthenticated') {
      setGithubStatusLoading(false);
      setInstallationsLoaded(true);
      setConfigurationLoaded(true);
      setGithubStatus({ connected: false });
      setHasExistingConfiguration(false);
    }
  }, [
    sessionStatus,
    checkGitHubStatus,
    fetchInstallations,
    loadExistingConfiguration,
  ]);

  useEffect(() => {
    if (
      !shouldRedirect ||
      hasRedirectedRef.current ||
      isLoadingConfiguration ||
      !configurationLoaded ||
      !installationsLoaded ||
      githubStatusLoading ||
      !githubStatus?.connected ||
      !hasExistingConfiguration ||
      !selectedRepository
    ) {
      return;
    }

    hasRedirectedRef.current = true;
    router.replace('/admin');
  }, [
    shouldRedirect,
    isLoadingConfiguration,
    configurationLoaded,
    installationsLoaded,
    githubStatusLoading,
    githubStatus?.connected,
    hasExistingConfiguration,
    selectedRepository,
    router,
  ]);

  const saveConfiguration = useCallback(async (
    repoName: string,
    installationIdValue: string,
    options?: { silent?: boolean }
  ): Promise<boolean> => {
    if (savingRef.current) {
      return false;
    }

    if (!installationIdValue || installationIdValue === '0') {
      setSaveError('Select a GitHub installation to continue.');
      return false;
    }

    if (!options?.silent) {
      setSaveMessage('');
      setSaveError('');
    }
    savingRef.current = true;
    setSaving(true);

    try {
      // Persist tracked repos selection
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repositoryFullName: repoName,
          installationId: Number(installationIdValue),
          trackedRepositories: selectedRepoFullNames,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSaveError('');
        lastSavedRef.current = { repo: repoName, installation: installationIdValue };
        if (!options?.silent) {
          setSaveMessage(`Configuration saved! ${selectedRepoFullNames.length} repositories selected.`);
        }
        return true;
      }

      setSaveError(result.error || 'Failed to save repository configuration');
      return false;
    } catch (error) {
      console.error('Error saving repository configuration:', error);
      setSaveError('An unexpected error occurred while saving repository');
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [selectedRepoFullNames]);

  const isInitializing = sessionStatus === 'loading' || githubStatusLoading || !configurationLoaded || !installationsLoaded;

  return (
    <div className="min-h-screen bg-gray-100">
      <SiteHeader isAuthenticated={Boolean(session)}/>

      {isInitializing ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center space-x-3 text-gray-600">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
            <span>Checking your GitHub connection…</span>
          </div>
        </div>
      ) : (
        <>

      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-8">
            Choose your Repositories
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            We monitor & create plain-English summaries of changes to your repositories.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 mb-20">
        {(authError || installationError || repoError) && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
            <p>
              {authError === 'github' 
                ? 'GitHub authentication failed. Please check your OAuth credentials and try again.' 
                : (installationError || repoError)}
            </p>
            <p className="mt-2">
            <Link
              href="/signin"
              className="font-semibold underline"
            >
              Sign in again
            </Link>
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-8">
          {/* Configuration Form - simplified */}
          <div className="lg:col-span-1">

              {githubStatus?.connected && (
                <>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-6">
                    <div className="flex items-center space-x-4">
                      {githubStatus.user?.avatar_url && (
                      <Image
                        src={githubStatus.user.avatar_url}
                        alt="Profile Avatar"
                        width={40}
                        height={40}
                        className="rounded-full"
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

                <div>
                  <div className="mb-8">
                    {installations.length > 1 && (
                      <select
                        value={selectedInstallationId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedInstallationId(id);
                          setSelectedRepository('');
                          if (id) fetchRepositories(id);
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

                    {installations.length === 0 ? (
                      <div className="px-6 pb-6">
                        <div className="p-4 border border-gray-200 rounded-xl bg-white">
                          <p className="text-sm text-gray-800">No installations found.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-gray-200 mt-2 rounded-xl overflow-hidden">
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-700">Repositories</h3>
                            {loadingRepos && (
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                <span>Loading…</span>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {repositories.map((repo) => {
                              const fullName = repo.full_name;
                              const selected = selectedRepoFullNames.includes(fullName);
                              return (
                                <button
                                  key={repo.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedRepoFullNames(prev =>
                                      prev.includes(fullName)
                                        ? prev.filter(n => n !== fullName)
                                        : [...prev, fullName]
                                    );
                                    setSelectedRepository(fullName);
                                  }}
                                  className={`text-left p-4 rounded-xl border transition-colors ${selected ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{repo.full_name}</div>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selected ? 'bg-green-600 border-green-600' : 'bg-white border-gray-300'}`}>
                                      {selected ? (
                                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
                                          <path d="M4 8.5 7 11l5-6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      ) : null}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <p className="mt-3 text-sm text-gray-500">Selected: {selectedRepoFullNames.length}</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <button
                        onClick={async () => {
                          if (selectedRepoFullNames.length === 0) {
                            setSaveError('Please select at least one repository.');
                            return;
                          }
                          if (!selectedInstallationId || selectedInstallationId === '0') {
                            setSaveError('Select a GitHub installation to continue.');
                            return;
                          }
                          const primaryRepo = selectedRepository || selectedRepoFullNames[0];
                          const saved = await saveConfiguration(primaryRepo, selectedInstallationId, { silent: false });
                          if (saved) {
                            hasRedirectedRef.current = true;
                            router.push('/admin');
                          }
                        }}
                        disabled={saving}
                        className="inline-flex items-center px-6 py-4 text-md font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        See Dashboard →
                      </button>
                    </div>
                  </div>

                  {saveMessage && (
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
                </>
              )}
          </div>
        </div>
      </div>
      <SiteFooter />
        </>
      )}
    </div>
  );
} 
