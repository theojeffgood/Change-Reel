import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authConfig } from '@/lib/auth/config';
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import Link from 'next/link';
import { GitHubConnectButton } from '@/app/signup/GitHubConnectButton';

export default async function SignUpPage() {
  const session = await getServerSession(authConfig);
  if (session) {
    redirect('/config');
  }

  const installUrl = process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL;
  const installUrlWithReturn = (() => {
    if (!installUrl) {
      return undefined;
    }
    const url = new URL(installUrl);
    url.searchParams.set('return_url', 'https://www.changereel.com/config');
    return url.toString();
  })();

  return (
    <div className="min-h-screen bg-gray-100">
      <SiteHeader isAuthenticated={false} />

      <div className="px-4 sm:px-6 lg:px-8 mt-12 mb-0">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mt-0 mb-8">
            Connect your GitHub
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Connect your development workflow. Get notifications when your product changes.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="rounded-4xl p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 mb-4">
            
            <div className="bg-white border border-gray-200 rounded-2xl py-4 px-6 flex flex-col items-center gap-0">
                <svg viewBox="0 0 24 24" className="w-9 h-9 text-gray-900" aria-hidden="true">
                  <ellipse cx="12" cy="6" rx="7" ry="3" fill="none" stroke="currentColor" strokeWidth="1.0"/>
                  <path d="M5 6v8c0 1.66 3.134 3 7 3s7-1.34 7-3V6" fill="none" stroke="currentColor" strokeWidth="1.0"/>
                  <path d="M5 10c0 1.66 3.134 3 7 3s7-1.34 7-3" fill="none" stroke="currentColor" strokeWidth="1.0"/>
                  <path d="M5 14c0 1.66 3.134 3 7 3s7-1.34 7-3" fill="none" stroke="currentColor" strokeWidth="1.0"/>
                  <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              <p className="text-sm text-center text-gray-700">Pass-through only. We don't save your data.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl py-4 px-8 flex flex-col items-center gap-0">
                <svg viewBox="0 0 24 24" className="w-9 h-9 text-gray-900" aria-hidden="true">
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" fill="none" stroke="currentColor" strokeWidth="1.3"/>
                  <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
              <p className="text-sm text-center text-gray-700">Read-only permissions.</p>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-0">
                <svg viewBox="0 0 24 24" className="w-10 h-10 text-gray-900" aria-hidden="true">
                  <path d="M8 10V8a4 4 0 118 0v2" fill="none" stroke="currentColor" strokeWidth="1.3"/>
                  <rect x="5" y="10" width="14" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M12 13v3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                  <circle cx="12" cy="13" r="0.8" fill="currentColor"/>
                </svg>
              <p className="text-sm text-center text-gray-700">We don't sell or share your data. Ever.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 mb-20">
        <div className="grid grid-cols-1 gap-8">
          <div className="lg:col-span-1">
            <div className="text-center">
              <div className="inline-flex flex-col items-center space-y-3">
                <GitHubConnectButton installUrl={installUrlWithReturn} />
              </div>
              <p className="text-md text-gray-600 max-w-2xl mx-auto mt-6 text-center">
                Already have an account? <Link href="/signin" className="text-blue-600 hover:text-blue-700">Sign in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
