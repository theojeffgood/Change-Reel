'use client';

import { trackEvent } from '@/lib/analytics';

interface GitHubConnectButtonProps {
  installUrl?: string;
}

export function GitHubConnectButton({ installUrl }: GitHubConnectButtonProps) {
  const handleClick = () => {
    trackEvent('github_connect_clicked');
  };

  return (
    <a
      href={installUrl || '#'}
      onClick={handleClick}
      aria-disabled={!installUrl}
      className={`inline-flex items-center mt-6 px-10 py-3 ${installUrl ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-400 text-white'} rounded-4xl transition-colors font-semibold`}
    >
      <svg className="mr-2 w-10 h-10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.018c0 4.424 2.865 8.176 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.004.071 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.833.091-.647.35-1.088.636-1.339-2.221-.253-4.555-1.112-4.555-4.943 0-1.091.39-1.986 1.029-2.686-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.851.004 1.707.115 2.506.337 1.909-1.296 2.748-1.026 2.748-1.026.546 1.378.202 2.397.099 2.65.64.7 1.028 1.595 1.028 2.686 0 3.841-2.337 4.687-4.565 4.936.359.31.678.923.678 1.861 0 1.343-.012 2.427-.012 2.758 0 .268.18.58.688.481A10.02 10.02 0 0022 12.018C22 6.484 17.523 2 12 2z"/>
      </svg>
      {installUrl ? 'Connect your GitHub' : 'Install URL not configured'}
    </a>
  );
}

