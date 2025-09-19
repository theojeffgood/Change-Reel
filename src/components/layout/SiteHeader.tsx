"use client";

import Link from 'next/link'

interface SiteHeaderProps {
  className?: string
  isAuthenticated?: boolean
  hasActiveConfiguration?: boolean
}

const SiteHeader = ({
  className = '',
  isAuthenticated = false,
  hasActiveConfiguration = false,
}: SiteHeaderProps) => {
  const setupHref = hasActiveConfiguration ? '/config?stay=1' : '/config';
  const setupLabel = isAuthenticated ? 'Setup' : 'Sign In';

  return (
    <nav className={`relative px-4 sm:px-6 lg:px-8 py-6 ${className}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          {/* <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">⚡</span>
          </div> */}
          <span className="text-xl font-bold text-gray-900">Wins Column</span>
        </Link>
        
        <div className="flex items-center space-x-4">
          <Link
            href={setupHref}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            {setupLabel}
          </Link>
          {!isAuthenticated && (
            <Link
              href="/admin"
              className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Get Started
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default SiteHeader; 
