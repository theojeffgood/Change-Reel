# Analytics & Event Tracking

This document provides an overview of the PostHog analytics implementation for tracking user behavior, conversions, and errors throughout the application.

## Architecture

### Core Components

1. **`src/lib/analytics/index.ts`** - Analytics utility wrapper
   - Provides safe interface to PostHog with initialization checks
   - Exports: `trackEvent()`, `trackError()`, `identifyUser()`, `resetAnalytics()`

2. **`src/lib/analytics/posthog-provider.tsx`** - PostHog initialization
   - Initializes PostHog client-side
   - Handles SPA pageview tracking
   - Sets up global error handlers

3. **`src/lib/analytics/error-boundary.tsx`** - React error boundary
   - Catches React rendering errors
   - Provides fallback UI
   - Tracks errors to PostHog

4. **`src/lib/auth/auth-provider.tsx`** - User identification
   - Identifies authenticated users via GitHub
   - Resets analytics on sign-out

## Configuration

### Environment Variables

Required in `.env` and `.cursor/mcp.json`:

```bash
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_project_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com  # or your custom host
```

### PostHog Settings

- **Pageview Capture**: Disabled (manual tracking via Next.js router)
- **Pageleave Capture**: Enabled
- **User Identification**: GitHub ID (stable across sessions)

## Event Tracking

### Analytics Functions

#### `trackEvent(eventName, properties?)`

Track custom events with optional properties.

```typescript
import { trackEvent } from '@/lib/analytics';

trackEvent('button_clicked', {
  location: 'header',
  button_text: 'Sign Up',
});
```

#### `trackError(errorType, error, context?)`

Track errors with context and stack traces.

```typescript
import { trackError } from '@/lib/analytics';

trackError('api_error', error, {
  action: 'save_configuration',
  repository_count: 5,
});
```

Error types:
- `'client_error'` - JavaScript errors, React errors
- `'api_error'` - API call failures
- `'auth_error'` - Authentication failures
- `'payment_error'` - Payment/checkout failures

#### `identifyUser(userId, properties?)`

Identify users (typically handled by auth provider).

```typescript
import { identifyUser } from '@/lib/analytics';

identifyUser(userId, {
  email: user.email,
  name: user.name,
});
```

#### `resetAnalytics()`

Reset analytics session (on logout).

```typescript
import { resetAnalytics } from '@/lib/analytics';

resetAnalytics();
```

## Tracked Events

### Signup & Onboarding Funnel

| Event | Properties | Description |
|-------|------------|-------------|
| `signup_cta_clicked` | `location`, `cta_text` | User clicks signup CTA |
| `github_connect_clicked` | - | User clicks GitHub connect button |
| `repository_selected` | `repository_name` | User selects a repository |
| `onboarding_completed` | `repository_count` | User completes configuration |
| `dashboard_viewed` | - | User first views dashboard |

**Funnel Flow**: Homepage → Signup → GitHub Connect → Repository Selection → Onboarding Complete → Dashboard

### Purchase Funnel

| Event | Properties | Description |
|-------|------------|-------------|
| `billing_page_viewed` | - | User views billing/pricing page |
| `plan_selected` | `plan`, `credit_pack`, `credits`, `price` | User selects a plan |
| `checkout_initiated` | `credit_pack`, `credits`, `price` | Stripe checkout loads |
| `purchase_completed` | - | Payment successful |

**Funnel Flow**: Billing Page → Plan Selection → Checkout Initiated → Purchase Complete

### Error Events

| Event | Properties | Description |
|-------|------------|-------------|
| `error_occurred` | `error_type`, `error_message`, `error_stack`, context | Any tracked error |

**Error Types**:
- Client errors: unhandled exceptions, React errors
- API errors: fetch failures, configuration save failures
- Payment errors: checkout session creation failures
- Auth errors: authentication/authorization failures

### Automatic Events

| Event | Properties | Description |
|-------|------------|-------------|
| `$pageview` | `$current_url` | Page navigation (SPA) |
| `$pageleave` | - | User leaves page |

## User Identification

Users are automatically identified on authentication:

**User ID**: GitHub ID (stable identifier)

**User Properties**:
- `email`: User's email
- `name`: User's name
- `github_login`: GitHub username
- `github_id`: GitHub user ID

## Error Tracking

### Automatic Error Tracking

Global error handlers automatically track:

1. **Unhandled JavaScript Errors**
   ```javascript
   throw new Error('Something broke'); // Automatically tracked
   ```

2. **Unhandled Promise Rejections**
   ```javascript
   fetch('/api/endpoint').then(res => {
     throw new Error('Unhandled error'); // Automatically tracked
   });
   ```

3. **React Rendering Errors**
   - Wrap components with `ErrorBoundary` to catch render errors
   - Provides fallback UI with reload option

### Manual Error Tracking

Track errors in catch blocks:

```typescript
try {
  await fetch('/api/endpoint');
} catch (error) {
  trackError('api_error', error, {
    action: 'fetch_data',
    endpoint: '/api/endpoint',
  });
}
```

### Current Error Tracking Points

- **Payment flow**: Checkout session creation failures
- **Configuration**: Repository save/load failures
- **Data fetching**: Commit history fetch failures
- **Global**: All unhandled errors and promise rejections

## Implementation Guidelines

### Adding New Events

1. **Use descriptive event names** in snake_case
   ```typescript
   trackEvent('repository_selected', { ... }); // ✅
   trackEvent('repoSelected', { ... });        // ❌
   ```

2. **Include relevant context** as properties
   ```typescript
   trackEvent('button_clicked', {
     location: 'header',
     button_text: 'Sign Up',
     destination: '/signup',
   });
   ```

3. **Track critical user actions**
   - Form submissions
   - Navigation between key pages
   - Feature usage
   - Conversion points

### Adding Error Tracking

1. **Wrap critical API calls** with try/catch
   ```typescript
   try {
     await criticalApiCall();
   } catch (error) {
     trackError('api_error', error, { action: 'critical_action' });
     // Handle error...
   }
   ```

2. **Include helpful context**
   ```typescript
   trackError('payment_error', error, {
     action: 'checkout_session_creation',
     credit_pack: 'credits1000',
     amount: 249,
   });
   ```

3. **Choose appropriate error type**
   - API failures → `'api_error'`
   - Payment issues → `'payment_error'`
   - Auth issues → `'auth_error'`
   - Client errors → `'client_error'`

### Best Practices

1. **Don't track PII** (passwords, credit card numbers)
2. **Keep event names consistent** across the codebase
3. **Document new events** in this file
4. **Test in development** (events logged to console)
5. **Use properties** for filtering and analysis
6. **Track errors** without disrupting user experience

## Analytics Dashboard

Access your PostHog dashboard to:
- View event funnels (signup, purchase)
- Analyze user behavior and retention
- Monitor error rates and types
- Track feature usage
- Identify conversion bottlenecks

## Development

### Local Testing

Events are logged to console in development:

```bash
[Analytics Error] api_error: Error: Failed to save configuration
  { action: 'save_configuration', repository_count: 5 }
```

### Debugging

Check if PostHog is loaded:

```typescript
import { isAnalyticsAvailable } from '@/lib/analytics';

if (isAnalyticsAvailable()) {
  console.log('PostHog is ready');
}
```

## Future Enhancements

Consider adding tracking for:

- **Feature engagement**: AI summary usage, email notifications
- **User retention**: Return visits, feature adoption
- **Performance**: Page load times, API latency
- **A/B testing**: Experiment variants and outcomes
- **Search/filters**: Dashboard interactions, commit filtering
- **Social proof**: Sharing, referrals

## Support

For questions or issues:
1. Check PostHog documentation: https://posthog.com/docs
2. Review this document
3. Check implementation in `src/lib/analytics/`

---

**Last Updated**: October 16, 2024

