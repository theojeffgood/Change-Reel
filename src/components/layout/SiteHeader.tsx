"use client";

import Link from 'next/link'
import { SignupCTA } from '@/components/SignupCTA'

interface SiteHeaderProps {
  className?: string
  isAuthenticated?: boolean
}

const SiteHeader = ({
  className = '',
  isAuthenticated = false,
}: SiteHeaderProps) => {
  const ctaLink = isAuthenticated ? '/config' : '/signin';
  const ctaLabel = isAuthenticated ? 'Settings' : 'Login';

  return (
    <nav className={`relative px-4 sm:px-6 lg:px-8 py-6 ${className}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold text-gray-900">Change Reel</span>
        </Link>
        
        <div className="flex items-center space-x-4">
          <Link
            href={ctaLink}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            {ctaLabel}
          </Link>
          {!isAuthenticated && (
            <SignupCTA
              location="header"
              text="Sign Up"
              className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              showIcon={false}
            />
          )}
        </div>
      </div>
    </nav>
  );
};

export default SiteHeader; 
