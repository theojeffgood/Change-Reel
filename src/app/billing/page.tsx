"use client"
import { Suspense, useState, useEffect } from 'react'
import { trackEvent } from '@/lib/analytics'
import BillingClient from './ui/BillingClient'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export default function BillingPage() {
  const [showCheckout, setIsCheckout] = useState(false)

  useEffect(() => {
    trackEvent('billing_page_viewed')
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {!showCheckout && <SiteHeader className="bg-white" />}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Suspense fallback={<div>Loading…</div>}>
          <BillingClient isCheckoutActive={setIsCheckout} />
        </Suspense>
      </div>
      {!showCheckout && <SiteFooter className="bg-white" />}
    </div>
  )
}


