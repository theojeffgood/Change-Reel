'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

export function DashboardTracker() {
  useEffect(() => {
    trackEvent('dashboard_viewed');
  }, []);

  return null;
}

