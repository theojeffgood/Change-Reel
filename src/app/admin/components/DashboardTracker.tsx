'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

export function DashboardTracker() {
  useEffect(() => {
    if (posthog.__loaded) {
      posthog.capture('dashboard_viewed');
    }
  }, []);

  return null;
}

