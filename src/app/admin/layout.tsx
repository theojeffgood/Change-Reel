'use client';

import { AdminUIProvider } from '@/lib/context/AdminUIContext';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import React, { useState } from 'react';
import { trackEvent } from '@/lib/analytics';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showThanks, setShowThanks] = useState(false);

  useEffect(() => {
    if (status === 'loading') return; // Still loading
    
    if (!session) {
      // Not authenticated, redirect to config page
      router.push('/config');
      return;
    }
    // If returning from Stripe checkout with session_id or purchase flag, kick off pending job processing
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const hasStripeSession = !!params?.get('session_id');
    const purchaseSuccess = (params?.get('purchase') || '').toLowerCase() === 'success';
    // Always attempt to retry previously failed (insufficient credits) jobs on load
    // After retrying, signal commits list to refresh so cards flip to "processing" state immediately
    fetch('/api/jobs/retry-insufficient', { method: 'POST', credentials: 'include' })
      .then(() => fetch('/api/jobs/process', { method: 'POST', credentials: 'include' }))
      .then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('commits:refresh'))
        }
      })
      .catch(() => {});

    if (hasStripeSession || purchaseSuccess) {
      setShowThanks(true);
      setTimeout(() => setShowThanks(false), 2000);
      
      // Track purchase completion
      trackEvent('purchase_completed');
      
      // Clean the URL to remove sensitive params
      router.replace('/admin');
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  return (
    <AdminUIProvider>
      {showThanks && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="rounded-lg bg-green-600 text-white px-4 py-2 shadow-lg">
            Thank you for your purchase!
          </div>
        </div>
      )}
      {children}
    </AdminUIProvider>
  );
} 