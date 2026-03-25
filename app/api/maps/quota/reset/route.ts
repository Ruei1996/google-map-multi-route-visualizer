/**
 * POST /api/maps/quota/reset
 *
 * Resets the global API quota counter to zero.
 * Protected by an optional QUOTA_RESET_TOKEN environment variable.
 *
 * Usage:
 *   curl -X POST /api/maps/quota/reset \
 *        -H "x-admin-token: <QUOTA_RESET_TOKEN>"
 */
import { NextRequest, NextResponse } from 'next/server';
import { resetQuota, getQuotaStatus } from '@/lib/maps/quota-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const expectedToken = process.env.QUOTA_RESET_TOKEN;

  // If a reset token is configured, enforce it
  if (expectedToken) {
    const provided = request.headers.get('x-admin-token');
    if (provided !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  resetQuota();

  return NextResponse.json({
    success: true,
    message: 'Quota counter has been reset to zero.',
    quotaStatus: getQuotaStatus(),
  });
}
