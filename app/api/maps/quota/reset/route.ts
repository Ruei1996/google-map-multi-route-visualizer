/**
 * POST /api/maps/quota/reset
 *
 * Resets the API quota counter for the current month.
 *
 * Behaviour:
 *  • When Supabase is enabled: deletes all api_calls rows for the current
 *    calendar month, so the monthly_usage view resets to zero.
 *  • Always also resets the in-memory counter.
 *
 * Security:
 *  Protected by an optional QUOTA_RESET_TOKEN environment variable.
 *  If set, the caller must supply a matching `x-admin-token` header.
 *
 * Usage:
 *   curl -X POST /api/maps/quota/reset \
 *        -H "x-admin-token: <QUOTA_RESET_TOKEN>"
 */
import { NextRequest, NextResponse } from 'next/server';
import { resetQuotaInDB, getQuotaStatusFromDB } from '@/lib/maps/quota-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/maps/quota/reset — reset all quota data for the current month */
export async function POST(request: NextRequest) {
  const expectedToken = process.env.QUOTA_RESET_TOKEN;

  // If a reset token is configured, enforce it
  if (expectedToken) {
    const provided = request.headers.get('x-admin-token');
    if (provided !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Reset quota in Supabase (and in-memory as fallback)
  await resetQuotaInDB();

  // Return the fresh quota status after the reset
  const quotaStatusByType = await getQuotaStatusFromDB();

  return NextResponse.json({
    success:           true,
    message:           'Quota counter has been reset to zero.',
    quotaStatus:       quotaStatusByType.combined,
    quotaStatusByType,
  });
}
