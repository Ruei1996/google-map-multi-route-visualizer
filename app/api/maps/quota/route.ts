/**
 * GET /api/maps/quota
 *
 * Returns the current API quota usage snapshot.
 * Called periodically by the frontend QuotaDashboard component.
 *
 * Response shape (QuotaStatusByType):
 *  {
 *    byType:         ApiTypeQuota[]   — per-API-type breakdown
 *    combined:       QuotaStatus      — legacy combined total
 *    isAnyExhausted: boolean
 *    isAnyWarning:   boolean
 *    storageBackend: 'supabase' | 'memory'
 *  }
 *
 * When Supabase is configured, data comes from the `monthly_usage` view.
 * When not configured, data comes from the in-memory quota-store.
 */
import { NextResponse } from 'next/server';
import { getQuotaStatusFromDB } from '@/lib/maps/quota-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/maps/quota — return full per-type quota status */
export async function GET() {
  const quotaStatusByType = await getQuotaStatusFromDB();
  return NextResponse.json(quotaStatusByType);
}
