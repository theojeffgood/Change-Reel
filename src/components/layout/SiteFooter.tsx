import Link from 'next/link'

export default function SiteFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`bg-gray-100 text-black px-4 sm:px-6 lg:px-8 py-12 ${className}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <Link href="/" className="flex items-center space-x-2 mb-4 md:mb-0">
            {/* <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">⚡</span>
            </div> */}
            <span className="text-xl font-bold text-black">Wins Column</span>
          </Link>
          <div className="flex space-x-6">
            <Link href="/config" className="hover:text-gray-700 transition-colors">Get Started</Link>
            <Link href="/admin" className="hover:text-gray-700 transition-colors">Dashboard</Link>
            <a href="mailto:support@winscolumn.com" className="hover:text-gray-700 transition-colors">Support</a>
          </div>
        </div>
        <div className="border-t border-gray-300 mt-8 pt-8 text-center">
          <p className="text-sm text-gray-600">
            © {new Date().getFullYear()} Wins Column. Transform your product updates into professional communication.
          </p>
        </div>
      </div>
    </footer>
  )
}


