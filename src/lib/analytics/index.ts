/**
 * Analytics utility wrapper for PostHog
 * 
 * Provides a safe interface to PostHog that handles initialization checks
 * and gracefully degrades when PostHog is not available.
 */

import posthog from 'posthog-js';

type EventProperties = Record<string, any>;

/**
 * Track an event in PostHog
 * Safely checks if PostHog is loaded before sending the event
 */
export function trackEvent(eventName: string, properties?: EventProperties): void {
  if (typeof window === 'undefined') return; // Server-side guard
  
  if (posthog.__loaded) {
    posthog.capture(eventName, properties);
  }
}

/**
 * Identify a user in PostHog
 * Safely checks if PostHog is loaded before identifying
 */
export function identifyUser(userId: string, properties?: EventProperties): void {
  if (typeof window === 'undefined') return; // Server-side guard
  
  if (posthog.__loaded) {
    posthog.identify(userId, properties);
  }
}

/**
 * Reset the PostHog session (e.g., on logout)
 */
export function resetAnalytics(): void {
  if (typeof window === 'undefined') return; // Server-side guard
  
  if (posthog.__loaded) {
    posthog.reset();
  }
}

/**
 * Check if PostHog is available and loaded
 */
export function isAnalyticsAvailable(): boolean {
  return typeof window !== 'undefined' && posthog.__loaded;
}

