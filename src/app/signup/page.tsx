import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authConfig } from '@/lib/auth/config';
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import Link from 'next/link';

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

      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-8">
            Connect your GitHub
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Connect your development workflow. Get notifications when your product changes.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 mb-20">
        <div className="grid grid-cols-1 gap-8">
          <div className="lg:col-span-1">
            <div className="text-center">
              <div className="inline-flex flex-col items-center space-y-3">
                <a
                  href={installUrlWithReturn || '#'}
                  aria-disabled={!installUrlWithReturn}
                  className={`inline-flex items-center mt-6 px-10 py-3 ${installUrlWithReturn ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-400 text-white'} rounded-4xl transition-colors font-semibold`}
                  >
                  <svg className="mr-2 w-7 h-10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.018c0 4.424 2.865 8.176 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.004.071 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.833.091-.647.35-1.088.636-1.339-2.221-.253-4.555-1.112-4.555-4.943 0-1.091.39-1.986 1.029-2.686-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.851.004 1.707.115 2.506.337 1.909-1.296 2.748-1.026 2.748-1.026.546 1.378.202 2.397.099 2.65.64.7 1.028 1.595 1.028 2.686 0 3.841-2.337 4.687-4.565 4.936.359.31.678.923.678 1.861 0 1.343-.012 2.427-.012 2.758 0 .268.18.58.688.481A10.02 10.02 0 0022 12.018C22 6.484 17.523 2 12 2z"/>
                  </svg>
                  {installUrl ? 'Connect your GitHub' : 'Install URL not configured'}
                </a>
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
