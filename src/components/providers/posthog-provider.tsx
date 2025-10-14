'use client';

import React, { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

interface PostHogProviderProps {
  children: React.ReactNode;
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Capture a pageview on the initial load and whenever the route/search changes
    if (typeof window !== 'undefined' && posthog.__loaded) {
      posthog.capture('$pageview', { $current_url: window.location.href });
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!key) {
      return;
    }

    // Initialize PostHog on the client. We disable automatic pageview capture
    // and capture SPA navigations manually using Next.js router hooks.
    posthog.init(key, {
      api_host: host || 'https://us.i.posthog.com',
      capture_pageview: false,
      capture_pageleave: true,
    });
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  );
}


