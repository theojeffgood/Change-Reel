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
