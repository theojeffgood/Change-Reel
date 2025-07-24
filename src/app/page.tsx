import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Navigation */}
      <nav className="relative px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">📰</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Change Reel</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link 
              href="/config" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Get Started
            </Link>
                          <Link 
                href="/admin" 
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Newsletter Dashboard
              </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
            Automate Your 
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Product Newsletter</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Keep your team, stakeholders, and customers informed about product updates without the manual work. 
            Beautiful, professional updates delivered automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/config" 
              className="inline-flex items-center px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
            >
              <span className="mr-2">🚀</span>
              Start Your Newsletter
            </Link>
            <Link 
              href="/admin" 
              className="inline-flex items-center px-8 py-4 border-2 border-gray-300 text-gray-700 text-lg font-semibold rounded-xl hover:border-gray-400 transition-colors"
            >
              <span className="mr-2">👀</span>
              See Example
            </Link>
          </div>
        </div>
      </div>

      {/* Value Proposition */}
      <div className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Turn Development Activity Into Business Communication
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Bridge the gap between what your team builds and what your stakeholders understand
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Benefit 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                <span className="text-2xl">⏰</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Save Hours Every Week</h3>
              <p className="text-gray-600 mb-4">
                No more manually writing update emails or status reports. Your product newsletter writes itself as your team ships features.
              </p>
              <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                <strong>ROI:</strong> 5+ hours saved per week per product manager
              </div>
            </div>

            {/* Benefit 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Keep Everyone Informed</h3>
              <p className="text-gray-600 mb-4">
                Executives, sales teams, and customers stay up-to-date with clear, professional summaries of what&apos;s new in your product.
              </p>
              <div className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
                <strong>Result:</strong> Better alignment and fewer "what&apos;s the status?" meetings
              </div>
            </div>

            {/* Benefit 3 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <span className="text-2xl">✨</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Professional & Consistent</h3>
              <p className="text-gray-600 mb-4">
                AI transforms technical changes into clear, business-focused updates that anyone can understand and act upon.
              </p>
              <div className="text-sm text-purple-700 bg-purple-50 px-3 py-2 rounded-lg">
                <strong>Impact:</strong> Enhanced team credibility and stakeholder confidence
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="px-4 sm:px-6 lg:px-8 py-16 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Set It Up Once, Benefits Forever
            </h2>
            <p className="text-xl text-gray-600">
              Three simple steps to transform your product communication
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">1</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Connect Your Product</h3>
              <p className="text-gray-600">
                Link your development repository in under 2 minutes. We&apos;ll automatically detect when new features ship.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">2</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">AI Creates Your Updates</h3>
              <p className="text-gray-600">
                Our AI automatically writes clear, professional summaries of new features, bug fixes, and improvements.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">3</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Stakeholders Stay Informed</h3>
              <p className="text-gray-600">
                Beautiful newsletters are delivered to your team, executives, and customers automatically.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need for Product Communication
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-blue-600 text-xl">🤖</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart AI Summaries</h3>
              <p className="text-gray-600 text-sm">Transforms technical changes into clear business language everyone understands</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-green-600 text-xl">📧</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Beautiful Email Newsletters</h3>
              <p className="text-gray-600 text-sm">Professional, branded emails that make your team look great</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-purple-600 text-xl">🌐</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Public Changelog</h3>
              <p className="text-gray-600 text-sm">Share updates with customers and prospects on a beautiful public page</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-orange-600 text-xl">⚡</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-Time Updates</h3>
              <p className="text-gray-600 text-sm">Updates are generated and sent as soon as new features go live</p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-red-600 text-xl">🎯</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Categorization</h3>
              <p className="text-gray-600 text-sm">Automatically sorts updates into features, fixes, and improvements</p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-indigo-600 text-xl">📊</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics & Insights</h3>
              <p className="text-gray-600 text-sm">See how your updates perform and what resonates with your audience</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Automate Your Product Communication?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join forward-thinking teams who have already transformed how they communicate product updates
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/config" 
              className="inline-flex items-center px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-xl hover:bg-gray-50 transition-colors shadow-lg"
            >
              <span className="mr-2">🚀</span>
              Start Your Free Newsletter
            </Link>
            <Link 
              href="/admin" 
              className="inline-flex items-center px-8 py-4 border-2 border-white text-white text-lg font-semibold rounded-xl hover:bg-white hover:text-blue-600 transition-colors"
            >
              <span className="mr-2">👀</span>
              View Live Demo
            </Link>
          </div>
          <p className="text-sm text-blue-200 mt-6">
            Setup takes 2 minutes • No credit card required • Cancel anytime
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">📰</span>
              </div>
              <span className="text-xl font-bold text-white">Change Reel</span>
            </div>
            <div className="flex space-x-6">
              <Link href="/config" className="hover:text-white transition-colors">Get Started</Link>
              <Link href="/admin" className="hover:text-white transition-colors">Dashboard</Link>
              <a href="mailto:support@changereel.com" className="hover:text-white transition-colors">Support</a>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-sm text-gray-400">
              © 2024 Change Reel. Transform your product updates into professional communication.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
