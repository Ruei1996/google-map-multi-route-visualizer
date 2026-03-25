/**
 * GET /api/maps/quota
 *
 * Returns the current API quota usage snapshot.
 * Called periodically by the frontend QuotaDashboard component.
 */
import { NextResponse } from 'next/server';
import { getQuotaStatus } from '@/lib/maps/quota-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(getQuotaStatus());
}
