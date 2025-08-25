'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string)

type PlanKey = 'growth' | 'enterprise'
type CreditPack = 'credits100' | 'credits1000'

export default function BillingClient() {
  const { data: session } = useSession()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Array<{ id: string; amount: number; type: 'credit' | 'debit'; description: string | null; created_at: string }>>([])
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null)
  const [showCheckout, setShowCheckout] = useState(false)

  const creditPackForPlan: Record<PlanKey, CreditPack> = useMemo(() => ({
    growth: 'credits100',
    enterprise: 'credits1000',
  }), [])

  async function createSession(credit_pack: CreditPack) {
    setLoading(true)
    setError(null)
    try {
      // Resolve internal UUID via server endpoint
      const me = await fetch('/api/users/me')
      if (!me.ok) throw new Error('Not signed in')
      const meJson = await me.json()
      const userId = meJson?.id
      if (!userId) throw new Error('Not signed in')

      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(userId),
        },
        body: JSON.stringify({ credit_pack }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create checkout session')
      setClientSecret(data.client_secret)
      setShowCheckout(true)
    } catch (e: any) {
      setError(e.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Do not auto-create session; wait for plan selection

  const handleSelectPlan = (plan: PlanKey) => {
    // If not signed in, route to config/auth like homepage CTAs
    if (!session) {
      if (typeof window !== 'undefined') window.location.assign('/config')
      return
    }
    setSelectedPlan(plan)
    createSession(creditPackForPlan[plan])
  }

  const handleBackToPlans = () => {
    setShowCheckout(false)
    setClientSecret(null)
  }

  return (
    <div className="space-y-6">
      {balance !== null && <div className="text-sm">Balance: <span className="font-semibold">{balance}</span> credits</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}

      {/* Plan selection (mirrors homepage styling) */}
      <div className={`${showCheckout ? 'opacity-0 pointer-events-none -translate-y-2' : 'opacity-100 translate-y-0'} transition-all duration-300`}> 
        {!showCheckout && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-14 px-0 sm:px-6">
            {/* Growth Pack (Most Popular) */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border-1 border-gray-200 relative">
              {/* <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">Most Popular</span>
              </div> */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Growth Pack</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">$29</span>
                  <span className="text-gray-600"> one‑time</span>
                </div>
                <div className="mb-2">
                  <span className="text-2xl font-bold text-blue-600">100</span>
                  <span className="text-gray-600"> credits</span>
                </div>
                {/* <p className="text-gray-600">(1 code change = 1 summary = 1 credit)</p> */}
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Unlimited repositories</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Support from an actual human</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Credits never expire</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">15% off replenished credits</span>
                </li>
              </ul>
              <button 
                onClick={() => handleSelectPlan('growth')} 
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Get Started
              </button>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 relative">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">$249</span>
                  <span className="text-gray-600"> one‑time</span>
                </div>
                <div className="mb-2">
                  <span className="text-2xl font-bold text-blue-600">1,500</span>
                  <span className="text-gray-600"> credits</span>
                </div>
                {/* <p className="text-gray-600">(0.067 per credit)</p> */}
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Unlimited repositories</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Priority support from an actual human</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Credits never expire</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">25% off replenished credits</span>
                </li>
              </ul>
              <button 
                onClick={() => handleSelectPlan('enterprise')} 
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stripe embedded checkout */}
      <div className={`${showCheckout ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none -translate-y-2'} transition-all duration-300`}>
        {showCheckout && (
          <div className="space-y-3">
            <button onClick={handleBackToPlans} className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700">
              <svg className="mr-1 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
              Back to plans
            </button>
            <div id="checkout" className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              {clientSecret && (
                <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              )}
            </div>
          </div>
        )}
      </div>

      {transactions.length > 0 && (
        <div>
          <h2 className="text-lg font-medium">Recent transactions</h2>
          <ul className="text-sm mt-2 space-y-1">
            {transactions.map(tx => (
              <li key={tx.id} className="flex justify-between border-b py-1">
                <span>{new Date(tx.created_at).toLocaleString()} — {tx.description || tx.type}</span>
                <span className={tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}>
                  {tx.type === 'credit' ? '+' : '-'}{tx.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}


