import { Suspense } from 'react'
import BillingClient from './ui/BillingClient'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export default async function BillingPage() {
  // Server component could fetch current balance and recent transactions later
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader className="bg-white" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* <h1 className="text-2xl font-semibold">Billing</h1> */}
        {/* <p className="text-sm text-gray-600">Purchase credits via Stripe Embedded Checkout.</p> */}
        <div className="mt-6">
          <Suspense fallback={<div>Loading…</div>}>
            <BillingClient />
          </Suspense>
        </div>
      </div>
      <SiteFooter className="bg-white" />
    </div>
  )
}


