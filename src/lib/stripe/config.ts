/*
 * Stripe environment configuration and validation utilities.
 * Ensures required variables are present without exposing sensitive values.
 */

export interface StripeEnvConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  priceIds: {
    credits100?: string;
    credits1000?: string;
  };
  creditsPerUsd: number; // e.g., 1000 => $1 == 1,000 credits
  markupPercent: number; // e.g., 20 => 20%
  successUrl: string; // e.g., /billing/success
  cancelUrl: string; // e.g., /billing
  isLiveMode: boolean;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : undefined;
}

function parseNumberEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric value for ${name}`);
  }
  return parsed;
}

export function getStripeEnvConfig(): StripeEnvConfig {
  const secretKey = getRequiredEnv("STRIPE_SECRET_KEY");
  const publishableKey = getRequiredEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  const webhookSecret = getRequiredEnv("STRIPE_WEBHOOK_SECRET");

  // Determine mode by key prefix (sk_live vs sk_test)
  const isLiveMode = secretKey.startsWith("sk_live_");

  const priceIds = {
    credits100: getOptionalEnv("STRIPE_PRICE_CREDITS_100"),
    credits1000: getOptionalEnv("STRIPE_PRICE_CREDITS_1000"),
  };

  const creditsPerUsd = parseNumberEnv("CREDITS_PER_USD", 1000);
  const markupPercent = parseNumberEnv("CREDITS_MARKUP_PERCENT", 20);
  const successUrl = getOptionalEnv("SUCCESS_URL") ?? "/billing/success";
  const cancelUrl = getOptionalEnv("CANCEL_URL") ?? "/billing";

  return {
    secretKey,
    publishableKey,
    webhookSecret,
    priceIds,
    creditsPerUsd,
    markupPercent,
    successUrl,
    cancelUrl,
    isLiveMode,
  };
}

export type { StripeEnvConfig as StripeConfig };


