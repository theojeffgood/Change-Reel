import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authConfig } from '@/lib/auth/config';
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import GithubSignInButton from './GithubSignInButton'

export default async function SignInPage() {
  const session = await getServerSession(authConfig);
  // Only redirect if session exists and has no auth error (e.g., not expired)
  if (session && !(session as any)?.error) {
    redirect('/config');
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <SiteHeader isAuthenticated={false} />

      <div className="px-4 sm:px-6 lg:px-8 mt-12 mb-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-6">
            Sign in again
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-4">
            Welcome back. Sign into your account.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 lg:px-10 pb-16 sm:mb-22 mb-16">
        <div className="grid grid-cols-1 gap-8">
          <div className="lg:col-span-1">
            <div className="text-center">
              <div className="inline-flex flex-col items-center space-y-3">
                <GithubSignInButton callbackUrl="/admin" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter className="sm:mt-10 mt-0" />
    </div>
  );
}
