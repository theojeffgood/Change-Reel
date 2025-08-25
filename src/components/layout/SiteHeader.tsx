import Link from 'next/link'

const SiteHeader = ({ className = '', isAuthenticated = true }: { className?: string, isAuthenticated?: boolean }) => {
  return (
    <nav className={`relative px-4 sm:px-6 lg:px-8 py-6 ${className}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">⚡</span>
          </div>
          <span className="text-xl font-bold text-gray-900">Wins Column</span>
        </Link>
        
        {isAuthenticated ? (
          <div className="flex items-center space-x-4">
          <Link 
            href="/config" 
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Setup
          </Link>
        </div>
        ) : (
          <div className="flex items-center space-x-4">
          <Link 
            href="/config" 
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Sign In
          </Link>
          <Link 
            href="/admin" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
        )}
      </div>
    </nav>
  );
};

export default SiteHeader; 