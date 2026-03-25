/**
 * POST /api/maps/calculate
 *
 * Backend proxy for the Google Maps Directions API.
 *
 * Security architecture:
 *  • GOOGLE_MAPS_API_KEY is NEVER exposed to the client — only read here.
 *  • Kill Switch: if the global quota counter is exhausted, the endpoint
 *    immediately returns HTTP 429 and performs ZERO Google API calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getQuotaStatus,
  incrementQuota,
  isQuotaExhausted,
} from '@/lib/maps/quota-store';
import type { CalculateRequest, RouteResult } from '@/types/maps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Eight visually distinct route colours
const ROUTE_COLORS = [
  '#EF4444', // red-500
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#F97316', // orange-500
];

export async function POST(request: NextRequest) {
  // ══════════════════════════════════════════
  //   KILL SWITCH — Block all calls when quota
  //   is exhausted to prevent billing charges.
  // ══════════════════════════════════════════
  if (isQuotaExhausted()) {
    return NextResponse.json(
      {
        error: 'QUOTA_EXHAUSTED',
        message:
          'The Google Maps API free quota has been fully consumed. ' +
          'All requests are blocked to prevent additional billing charges. ' +
          'Please reset the quota counter or wait for the next billing cycle.',
        quotaStatus: getQuotaStatus(),
      },
      { status: 429 },
    );
  }

  // ── Validate API key ───────────────────────
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'SERVER_MISCONFIGURED',
        message: 'Google Maps API key is not configured on the server.',
      },
      { status: 500 },
    );
  }

  // ── Parse & validate request body ─────────
  let body: CalculateRequest;
  try {
    body = (await request.json()) as CalculateRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { origin, destinations } = body;

  if (!origin?.trim()) {
    return NextResponse.json(
      { error: 'Origin location is required.' },
      { status: 400 },
    );
  }
  if (!destinations || destinations.length === 0) {
    return NextResponse.json(
      { error: 'At least one destination is required.' },
      { status: 400 },
    );
  }

  // ── Geocode the origin for map centering ──
  let originCoords: { lat: number; lng: number } | undefined;
  try {
    const p = new URLSearchParams({ address: origin, key: apiKey, language: 'zh-TW' });
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${p}`);
    const data = await res.json();
    incrementQuota(1);
    if (data.status === 'OK' && data.results?.[0]) {
      originCoords = data.results[0].geometry.location as { lat: number; lng: number };
    }
  } catch {
    // Non-fatal — map will centre on the first successful route leg
  }

  // ── Fetch each route from Google Directions API ──
  const routes: RouteResult[] = [];

  for (let i = 0; i < destinations.length; i++) {
    // Re-check kill switch before each individual API call
    if (isQuotaExhausted()) {
      routes.push({
        locationId: destinations[i].id,
        address: destinations[i].address,
        index: i + 1,
        distance: 'N/A',
        distanceValue: 0,
        duration: 'N/A',
        status: 'error',
        errorMessage: 'Quota exhausted — this destination was not calculated.',
        color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      });
      continue;
    }

    const dest = destinations[i];
    const params = new URLSearchParams({
      origin,
      destination: dest.address,
      key: apiKey,
      language: 'zh-TW',
    });

    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?${params}`,
      );
      const data = await res.json();
      incrementQuota(1);

      if (data.status === 'OK' && data.routes?.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        const distanceKm = (leg.distance.value / 1000).toFixed(1);

        // Use the first successful leg as origin coords fallback
        if (!originCoords && leg.start_location) {
          originCoords = leg.start_location as { lat: number; lng: number };
        }

        routes.push({
          locationId: dest.id,
          address: dest.address,
          index: i + 1,
          distance: `${distanceKm} km`,
          distanceValue: leg.distance.value,
          duration: leg.duration.text,
          status: 'success',
          encodedPolyline: route.overview_polyline.points as string,
          color: ROUTE_COLORS[i % ROUTE_COLORS.length],
          startLocation: leg.start_location as { lat: number; lng: number },
          endLocation: leg.end_location as { lat: number; lng: number },
        });
      } else {
        routes.push({
          locationId: dest.id,
          address: dest.address,
          index: i + 1,
          distance: 'N/A',
          distanceValue: 0,
          duration: 'N/A',
          status: 'error',
          errorMessage: `Google Maps: ${data.status ?? 'Unknown error'}`,
          color: ROUTE_COLORS[i % ROUTE_COLORS.length],
        });
      }
    } catch (err) {
      routes.push({
        locationId: dest.id,
        address: dest.address,
        index: i + 1,
        distance: 'N/A',
        distanceValue: 0,
        duration: 'N/A',
        status: 'error',
        errorMessage: 'Network error while fetching route.',
        color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      });
    }
  }

  return NextResponse.json({ routes, quotaStatus: getQuotaStatus(), originCoords });
}
