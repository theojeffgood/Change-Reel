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
            <span className="text-xl font-bold text-gray-900">Wins Column</span>
          </div>
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
        </div>
      </nav>

      {/* Hero Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-4xl mx-auto text-center">
                      {/* Toast */}
            <div className="inline-flex items-center px-4 py-1 mb-8 text-black text-sm font-medium rounded-full border-1 border-gray-300">
              <span className="mr-2 animate-pulse">✨</span>
              AI-Powered Product Updates
            </div>
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
            What your Team Ships
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Delivered in Plain English</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
          We watch your codebase, scan for changes, and write what we find. Product comms, automated. 
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/config" 
              className="inline-flex items-center px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
            >
              <span className="mr-2">🚀</span>
                             Start free with GitHub →
            </Link>
            <Link 
              href="#live-example" 
              className="inline-flex items-center px-8 py-4 border-2 border-gray-300 text-gray-700 text-lg font-semibold rounded-xl hover:border-gray-400 transition-colors"
            >
              <span className="mr-2">👀</span>
              See Example
            </Link>
          </div>
          
          {/* Feature Toasts */}
          <div className="flex flex-col sm:flex-row gap-14 justify-center mt-12">
            <div className="inline-flex items-center px-4 py-2 text-gray-600 text-sm font-medium">
              <span className="mr-2">🎟️</span>
              Pay As You Go
            </div>
            <div className="inline-flex items-center px-4 py-2 text-gray-600 text-sm font-medium">
              <span className="mr-2">⚡</span>
              Real-time Updates
            </div>
            <div className="inline-flex items-center px-4 py-2 text-gray-600 text-sm font-medium">
              <span className="mr-2">🤖</span>
              Powered by GPT-4
            </div>
          </div>
        </div>
      </div>

      {/* Live Example */}
      <div id="live-example" className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              See Our AI In Action
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Watch how technical changes become clear business updates in seconds
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left Side - Code Example */}
              <div className="relative">
                <div className="bg-white rounded-xl py-6 font-mono text-sm border border-gray-200">
                  <div className="flex items-center mb-6">
                    
                    <div className="flex px-6 space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>  
                  </div>

                  <div className="space-y-0.5">
                    <div className="px-6 text-gray-700 py-0.5">
                      <span className="text-blue-600">func</span> <span className="text-purple-600">videoPlayback</span> {'{'}</div>
                    <div className="px-6 text-gray-700 ml-4 py-0.5">
                      <span className="text-orange-600">startVideo</span>()</div>
                    <div className="px-6 text-gray-700 ml-4 py-0.5">
                      <span className="text-orange-600">minimizeVideoControls</span>()</div>
                    
                    {/* Empty line above hunk */}
                    <div className="py-1.5"></div>
                    
                    {/* Added lines */}
                    <div className="flex items-center bg-green-50">
                      <span className="px-3 text-green-600 mr-3 font-mono text-sm w-4 text-center">+</span>
                      <div className="y-0.5 flex-1">
                        <div className="text-gray-700">
                          <span className="ml-1.5 text-purple-600">video</span>.<span className="text-green-600">didEnd</span> = {'{'}</div>
                      </div>
                    </div>
                    <div className="flex items-center bg-green-50">
                      <span className="px-3 text-green-600 mr-3 font-mono text-sm w-4 text-center">+</span>
                      <div className="py-0.5 flex-1">
                        <div className="text-gray-700 ml-4">
                          <span className="ml-1.5text-blue-600">if</span> <span className="text-purple-600">user</span>.<span className="text-green-600">isFreeTrial</span> {'{'}</div>
                      </div>
                    </div>
                    <div className="flex items-center bg-green-50">
                      <span className="px-3 text-green-600 mr-3 font-mono text-sm w-4 text-center">+</span>
                      <div className="py-0.5 flex-1">
                        <div className="text-gray-700 ml-8">
                          <span className="ml-1.5 text-orange-600">showPaywall</span>()</div>
                      </div>
                    </div>
                    <div className="flex items-center bg-green-50">
                      <span className="px-3 text-green-600 mr-3 font-mono text-sm w-4 text-center">+</span>
                      <div className="py-0.5 flex-1">
                        <div className="ml-1.5 text-gray-700 ml-4">{'}'}</div>
                      </div>
                    </div>
                    <div className="flex items-center bg-green-50">
                      <span className="px-3 text-green-600 mr-3 font-mono text-sm w-4 text-center">+</span>
                      <div className="py-0.5 flex-1">
                        <div className="ml-1.5 text-gray-700">{'}'}</div>
                      </div>
                    </div>
                    
                    {/* Empty line below hunk */}
                    <div className="py-1.5"></div>
                    
                    <div className="px-3 text-gray-700 py-0.5">{'}'}</div>
                  </div>
                </div>
                <div className="absolute -right-16 top-1/2 transform -translate-y-1/2 hidden lg:block">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Right Side - Plain English Description */}
              <div className="lg:pl-8">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                  {/* Email Header */}
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">WC</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">Wins Column</h3>
                          <p className="text-xs text-gray-500">Product Updates</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Today, 2:34 PM</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Email Body */}
                  <div className="px-6 py-4">
                    <div className="space-y-3">
                      <p className="text-sm mb-4 text-gray-600">
                        Hi team, <br/><br/>
                      </p>
                      <p className="text-sm text-gray-800 leading-relaxed">
                        Video playback was updated for unpaid users. 
                        Now, they will see the paywall when video playback ends.
                        <br/><br/>
                      </p>
                      
                      <p className="text-sm mt-4 text-gray-600">
                        - Wins Column
                      </p>
                    </div>
                  </div>
                </div>
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
              Automate your Product Comms
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
              <h3 className="text-xl font-bold text-gray-900 mb-4">Connect Your GitHub Account</h3>
              <p className="text-gray-600">
                Select your repository. No integrations. No API keys. We&apos;ll automatically detect when new features ship.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">2</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Our AI Watches Your Updates</h3>
              <p className="text-gray-600">
                We watch for commits & pull requests. Then we run the diffs through our AI to see what's changed.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">3</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Updates in Plain English</h3>
              <p className="text-gray-600">
                Our AI automatically writes clear, professional summaries of new features, bug fixes, and improvements.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Choose the plan that fits your team size and newsletter needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 relative">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Starter</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">$49</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <div className="mb-2">
                  <span className="text-2xl font-bold text-blue-600">500</span>
                  <span className="text-gray-600"> credits</span>

                </div>
                <p className="text-gray-600">~$0.10 per credit</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">1 repository connection</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Up to 100 newsletter subscribers</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Basic email templates</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Email support</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Credits never expire</span>
                </li>
              </ul>

              <Link 
                href="/config" 
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Professional Plan */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-blue-500 relative transform scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">Most Popular</span>
              </div>
              
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Professional</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">$149</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <div className="mb-2">
                  <span className="text-2xl font-bold text-blue-600">2,000</span>
                  <span className="text-gray-600"> credits</span>

                </div>
                <p className="text-gray-600">~$0.075 per credit</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Up to 5 repository connections</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Up to 1,000 newsletter subscribers</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Custom email templates</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Advanced analytics dashboard</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Priority email support</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Slack integration</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Credits never expire</span>
                </li>
              </ul>

              <Link 
                href="/config" 
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 relative">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">$399</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <div className="mb-2">
                  <span className="text-2xl font-bold text-blue-600">6,000</span>
                  <span className="text-gray-600"> credits</span>

                </div>
                <p className="text-gray-600">~$0.067 per credit</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Unlimited repository connections</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Unlimited newsletter subscribers</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">White-label newsletters</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Advanced team management</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">API access</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Dedicated account manager</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Phone & email support</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Credits never expire</span>
                </li>
              </ul>

              <Link 
                href="/config" 
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
              >
                Contact Sales
              </Link>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4">
              All plans include a 14-day free trial • Credits never expire • Cancel anytime
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Each credit generates one product update newsletter. Need more? <a href="mailto:sales@winscolumn.com" className="text-blue-600 hover:text-blue-700">Contact our sales team</a>
            </p>
            <div className="bg-gray-50 rounded-lg p-4 max-w-2xl mx-auto">
              <p className="text-sm text-gray-700">
                <strong>How credits work:</strong> Every time your team pushes code changes, we use 1 credit to generate and send a professional product update newsletter to your stakeholders.
              </p>
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
              Start free with GitHub →
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
              <span className="text-xl font-bold text-white">Wins Column</span>
            </div>
            <div className="flex space-x-6">
              <Link href="/config" className="hover:text-white transition-colors">Get Started</Link>
              <Link href="/admin" className="hover:text-white transition-colors">Dashboard</Link>
              <a href="mailto:support@winscolumn.com" className="hover:text-white transition-colors">Support</a>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-sm text-gray-400">
              © 2024 Wins Column. Transform your product updates into professional communication.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}



