/**
 * GitHub Webhook Signature Validation Utility
 * 
 * Provides functions for validating GitHub webhook signatures using HMAC-SHA256.
 * This is used to verify that webhook payloads are actually from GitHub.
 */

/**
 * Validate a GitHub webhook signature using HMAC-SHA256
 * @param payload The raw webhook payload as a string
 * @param signature The signature from the x-hub-signature-256 header
 * @param secret The webhook secret configured in GitHub
 * @returns true if the signature is valid, false otherwise
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const calculatedSignature = `sha256=${hmac.digest('hex')}`;
    
    // Use timingSafeEqual to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(calculatedSignature)
    );
  } catch (error) {
    console.error('Error validating webhook signature:', error);
    return false;
  }
}

/**
 * Generate a cryptographically secure webhook secret
 * @returns A 64-character hex string suitable for use as a webhook secret
 */
export function generateWebhookSecret(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}
