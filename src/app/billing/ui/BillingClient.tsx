'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string)

export default function BillingClient() {
  const { data: session } = useSession()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Array<{ id: string; amount: number; type: 'credit' | 'debit'; description: string | null; created_at: string }>>([])

  async function createSession(credit_pack: 'credits1k' | 'credits10k' | 'credits100k') {
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
    } catch (e: any) {
      setError(e.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Show embedded checkout by default with 1k credits
  useEffect(() => {
    if (!clientSecret && !loading && session) {
      createSession('credits1k')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  return (
    <div className="space-y-4">
      {balance !== null && <div className="text-sm">Balance: <span className="font-semibold">{balance}</span> credits</div>}
      {/* <div className="space-x-2">
        <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => createSession('credits1k')} disabled={loading}>Buy 1k credits</button>
        <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => createSession('credits10k')} disabled={loading}>Buy 10k credits</button>
        <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => createSession('credits100k')} disabled={loading}>Buy 100k credits</button>
      </div> */}
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div id="checkout">
        {clientSecret && (
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
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


