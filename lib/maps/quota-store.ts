/**
 * In-Memory API Quota Store — Google Maps Directions API
 *
 * Tracks the total number of Google Maps API calls made by this Node.js
 * process. Enforces a hard cap to prevent any charge beyond the free tier.
 *
 * Pricing reference (as of 2025):
 *   • Directions API  : $5 / 1,000 requests
 *   • Free credit     : $200 / month  →  40,000 requests
 *
 * ⚠️  Production Note:
 *   This in-memory singleton is suitable for single-instance deployments.
 *   In serverless/edge environments (Vercel, AWS Lambda) each cold-start
 *   creates a new memory space.  Replace with Redis / KV for distributed
 *   quota enforcement.
 */

const QUOTA_LIMIT = parseInt(process.env.MAPS_QUOTA_LIMIT ?? '40000', 10);

interface Store {
  used: number;
  limit: number;
  lastReset: string;
}

// Module-level singleton — survives across requests in the same process
const store: Store = {
  used: 0,
  limit: QUOTA_LIMIT,
  lastReset: new Date().toISOString(),
};

export function getQuotaStatus() {
  const remaining = Math.max(0, store.limit - store.used);
  const percentage = Math.min(100, (store.used / store.limit) * 100);
  return {
    used: store.used,
    limit: store.limit,
    remaining,
    percentage,
    isExhausted: store.used >= store.limit,
    isWarning: remaining > 0 && remaining <= store.limit * 0.1,
    lastReset: store.lastReset,
  };
}

export function incrementQuota(count = 1): void {
  store.used = Math.min(store.limit, store.used + count);
}

export function resetQuota(): void {
  store.used = 0;
  store.lastReset = new Date().toISOString();
}

export function isQuotaExhausted(): boolean {
  return store.used >= store.limit;
}
