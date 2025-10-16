import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { SignupCTA } from '@/components/SignupCTA';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader isAuthenticated={false} />

      {/* Hero Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 py-8">
            {/* Code Updates in Plain-English */}
            Notifications <br/> from your codebase. <br/> In plain English
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Know what your engineers build. Without asking.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignupCTA
              location="hero"
              text="Start free with GitHub →"
              className="inline-flex items-center px-8 py-4 bg-black text-white text-lg font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-lg"
            />
            <Link 
              href="#live-example" 
              className="inline-flex items-center px-8 py-4 border-2 border-gray-300 text-gray-700 text-lg font-semibold rounded-xl hover:border-gray-400 transition-colors"
            >
              See Example
            </Link>
          </div>
          
          {/* Feature Toasts */}
          <div className="flex flex-col sm:flex-row gap-14 justify-center mt-12">
            <div className="inline-flex items-center px-4 py-2 text-gray-600 text-sm font-medium">
              <span className="mr-2">🎟️</span>
              No Subscription
            </div>
            <div className="inline-flex items-center px-4 py-2 text-gray-600 text-sm font-medium">
              <span className="mr-2">⚡</span>
              Real-time Updates
            </div>
            <div className="inline-flex items-center px-4 py-2 text-gray-600 text-sm font-medium">
              <span className="mr-2">🤖</span>
              Powered by GPT-5
            </div>
          </div>
        </div>
      </div>

      {/* Live Example */}
      <div id="live-example" className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {/* <div className="text-center mb-8">
            <h3 className="text-3xl md:text-4xl font-medium text-gray-900 mb-2">
            Turn technical changes into clear updates in seconds
            </h3>
          </div> */}

          <div className="bg-gray-50 rounded-3xl p-8 shadow-lg border border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left Side - Code Example */}
              <div className="relative">
                <div className="mb-3 text-xl text-black font-semibold uppercase tracking-wide">Turn this</div>
                <div className="bg-white rounded-xl py-6 font-mono text-lg border border-gray-200">

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
                          <span className="ml-1.5 text-purple-600">video</span>.<span className="text-green-600">hasEnded</span> = {'{'}</div>
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
                        <div className="ml-1.5 text-gray-700">{'}'}</div>
                      </div>
                    </div>
                    
                    {/* Empty line below hunk */}
                  </div>
                </div>
                <div className="absolute -right-16 top-1/2 transform -translate-y-1/2 hidden lg:block">
                  <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Right Side - Summary Card (Admin-style) */}
              <div className="lg:pl-8">
                <div className="mb-3 text-xl text-black font-semibold uppercase tracking-wide">Into this</div>
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-md">

                  <h3 className="text-xl font-semibold text-gray-900 mb-6">New Feature!</h3>
                  <p className="text-gray-800 text-lg leading-relaxed mb-8">
                    Users in the free-trial now see a paywall when their video ends.
                  </p>
                  <p className="text-gray-800 text-xs leading-relaxed mb-8">
                    Shipped on: 8-23-25
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Value Props */}
      <div className="px-4 sm:px-6 lg:px-8 py-16 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Insights at your fingertips. All without asking
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            When someone pushes to GitHub, Change Reel sends out an update. Keep your sales team aligned.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Plugs directly into your tech stack */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex items-start space-x-4">
              <div className="w-12 h-12 rounded-lg border border-blue-100 flex items-center justify-center text-blue-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="7" x2="20" y2="7"></line>
                  <line x1="4" y1="12" x2="20" y2="12"></line>
                  <line x1="4" y1="17" x2="20" y2="17"></line>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Plugs Into Your Tech Stack</h3>
                <p className="text-gray-600">Any tech. Every language. All stacks</p>
              </div>
            </div>

            {/* No integration necessary */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex items-start space-x-4">
              <div className="w-12 h-12 rounded-lg border border-blue-100 flex items-center justify-center text-blue-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="M9 12l2 2 4-4"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">No Integration Needed</h3>
                <p className="text-gray-600">Zero</p>
              </div>
            </div>

            {/* Insights-tied-to-performance */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex items-start space-x-4">
              <div className="w-12 h-12 rounded-lg border border-blue-100 flex items-center justify-center text-blue-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4,14 9,10 13,12 20,6"></polyline>
                  <line x1="4" y1="20" x2="20" y2="20"></line>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Proprietary Insights</h3>
                <p className="text-gray-600">4-factor analysis including raw code diffs, comments, commit messages, history</p>
              </div>
            </div>

            {/* Smart alerts */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex items-start space-x-4">
              <div className="w-12 h-12 rounded-lg border border-blue-100 flex items-center justify-center text-blue-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"></circle>
                  <line x1="12" y1="8" x2="12" y2="13"></line>
                  <circle cx="12" cy="16" r="1"></circle>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Smart Alerts <span className="ml-2 text-xs font-medium text-blue-600 uppercase">New!</span></h3>
                <p className="text-gray-600">Get notified when your team ships</p>
              </div>
            </div>

            {/* Secure */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex items-start space-x-4">
              <div className="w-12 h-12 rounded-lg border border-blue-100 flex items-center justify-center text-blue-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="8" rx="2"></rect>
                  <path d="M8 11V8a4 4 0 018 0v3"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Secure</h3>
                <p className="text-gray-600">We don't store your data</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section - Pay-as-you-go Credits */}
      <div className="px-4 sm:px-6 lg:px-8 py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Only pay for what you use
            </h2>
            {/* <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              No subscription here
            </p> */}
            <p className="text-gray-600 mt-4">(1 code change = 1 summary = 1 credit)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-14 px-14">
            {/* Starter Pack */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 relative">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Starter Pack</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">$0</span>
                  {/* <span className="text-gray-600"> free</span> */}
                </div>
                <div className="mb-2">
                  <span className="text-2xl font-bold text-black">3</span>
                  <span className="text-gray-600"> free credits</span>

                </div>
                {/* <p className="text-gray-600">Free credits to start</p> */}
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-black mr-3">✓</span>
                  <span className="text-gray-700">1 repository </span>
                </li>
                <li className="flex items-center">
                  <span className="text-black mr-3">✓</span>
                  <span className="text-gray-700">Support from an actual human</span>
                </li>
                <li className="flex items-center">
                  <span className="text-black mr-3">✓</span>
                  <span className="text-gray-700">Replenish what you need</span>
                </li>
              </ul>

              <SignupCTA
                location="pricing"
                text="Get Started"
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-white text-black font-semibold rounded-lg border-black border-1 hover:bg-gray-200 transition-colors"
                showIcon={false}
              />
            </div>

            {/* Growth Pack */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-black relative transform scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-black text-white px-4 py-1 rounded-full text-sm font-semibold">Most Popular</span>
              </div>
              
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Growth Pack</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">$29</span>
                  <span className="text-gray-600"> one‑time</span>
                </div>
                <div className="mb-2">
                  <span className="text-2xl font-bold text-black">100</span>
                  <span className="text-gray-600"> credits</span>

                </div>
                {/* <p className="text-gray-600">(0.075 per credit)</p> */}
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-black mr-3">✓</span>
                  <span className="text-gray-700">Unlimited repositories</span>
                </li>
                <li className="flex items-center">
                  <span className="text-black mr-3">✓</span>
                  <span className="text-gray-700">Support from an actual human</span>
                </li>
                <li className="flex items-center">
                  <span className="text-black mr-3">✓</span>
                  <span className="text-gray-700">Credits never expire</span>
                </li>
                <li className="flex items-center">
                  <span className="text-black mr-3">✓</span>
                  <span className="text-gray-700">15% off replenished credits</span>
                </li>
              </ul>

              <SignupCTA
                location="pricing"
                text="Start Free"
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                showIcon={false}
              />
            </div>

            {/* Scale Pack */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 relative">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">$249</span>
                  <span className="text-gray-600"> one‑time</span>
                </div>
                <div className="mb-2">
                  <span className="text-2xl font-bold text-black">1,500</span>
                  <span className="text-gray-600"> credits</span>

                </div>
                {/* <p className="text-gray-600">(0.067 per credit)</p> */}
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-black mr-3">✓</span>
                  <span className="text-gray-700">Unlimited repositories</span>
                </li>
                <li className="flex items-center">
                  <span className="text-black mr-3">✓</span>
                  <span className="text-gray-700">Priority support from an actual human</span>
                </li>
                <li className="flex items-center">
                  <span className="text-black mr-3">✓</span>
                  <span className="text-gray-700">Credits never expire</span>
                </li>
                <li className="flex items-center">
                  <span className="text-black mr-3">✓</span>
                  <span className="text-gray-700">25% off replenished credits</span>
                </li>
              </ul>

              <Link 
                href="mailto:theo@changereel.com" 
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-white text-black font-semibold rounded-lg border-gray-500 border-1 hover:bg-gray-200 transition-colors"
              >
                Contact Sales
              </Link>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4">
              Credits never expire • Cancel anytime
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto text-center p-14 rounded-4xl bg-black">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Built for busy teams who ship.
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join forward-thinking teams who have already transformed how they communicate product updates
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignupCTA
              location="footer"
              text="Start free with GitHub →"
              className="inline-flex items-center px-8 py-4 bg-white text-black text-lg font-semibold rounded-xl hover:bg-gray-50 transition-colors shadow-lg"
            />
            <Link 
              href="#live-example" 
              className="inline-flex items-center px-8 py-4 border-2 border-white text-white text-lg font-semibold rounded-xl hover:bg-white hover:text-blue-600 transition-colors"
            >
              See Example
            </Link>
          </div>
          <p className="text-sm text-blue-200 mt-6">
            Setup takes 2 minutes • Credits never expire • Cancel anytime
          </p>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}



