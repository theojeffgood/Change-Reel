import Stripe from 'stripe';
import { getStripeEnvConfig } from '@/lib/stripe/config';

let stripeSingleton: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeSingleton) {
    return stripeSingleton;
  }
  const cfg = getStripeEnvConfig();
  stripeSingleton = new Stripe(cfg.secretKey, {
    // Use SDK's pinned API version to avoid TS type mismatches
    typescript: true,
  });
  return stripeSingleton;
}

export type CreditPackKey = 'credits1k' | 'credits10k' | 'credits100k';

export interface CreditPackMapping {
  credits1k?: string;
  credits10k?: string;
  credits100k?: string;
}

export function getCreditPackPriceId(key: CreditPackKey): string | undefined {
  const { priceIds } = getStripeEnvConfig();
  return priceIds[key];
}


