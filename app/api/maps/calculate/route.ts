/**
 * POST /api/maps/calculate
 *
 * Backend proxy for the Google Maps Directions API.
 *
 * Security architecture:
 *  • GOOGLE_MAPS_API_KEY is NEVER exposed to the client — only read here.
 *  • Kill Switch: if the global quota counter is exhausted, the endpoint
 *    immediately returns HTTP 429 and performs ZERO Google API calls.
 *
 * Supported options (passed via request body):
 *  • travelMode        — driving | motorcycle | transit | walking | bicycling
 *  • avoidOptions      — tolls | highways | ferries | indoor (array)
 *  • transitModes      — bus | subway | train | tram | rail (array, transit only)
 *  • transitPreference — less_walking | fewer_transfers (transit only)
 *  • trafficModel      — best_guess | pessimistic | optimistic (driving only)
 *  • departureTime     — "now" or Unix timestamp string (enables traffic data)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getQuotaStatus,
  incrementQuota,
  isQuotaExhausted,
} from '@/lib/maps/quota-store';
import type {
  CalculateRequest,
  RouteResult,
  TravelMode,
  AvoidOption,
  TransitMode,
  TransitRoutingPreference,
  TrafficModel,
} from '@/types/maps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Colour palette ─────────────────────────────────────────
/** Eight visually distinct route colours cycling across destinations */
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

// ── Helpers ────────────────────────────────────────────────

/**
 * Map our internal TravelMode to the Google Directions API `mode` value.
 * NOTE: Google's REST Directions API does not have a motorcycle mode for most
 * regions (including Taiwan). We fall back to 'driving' which uses the same
 * road network; the UI label still shows 機車 for clarity.
 */
function toGoogleMode(mode: TravelMode | undefined): string {
  switch (mode) {
    case 'walking':    return 'walking';
    case 'bicycling':  return 'bicycling';
    case 'transit':    return 'transit';
    case 'motorcycle': return 'driving'; // fallback — no separate motorcycle mode
    case 'driving':
    default:           return 'driving';
  }
}

/**
 * Build the `avoid` query-string value from an array of AvoidOption.
 * Multiple avoids are joined with '|' per the Directions API spec.
 * e.g. ['tolls', 'highways'] → 'tolls|highways'
 */
function buildAvoidParam(avoids: AvoidOption[] | undefined): string | null {
  if (!avoids || avoids.length === 0) return null;
  // 'indoor' is only valid for walking / transit — callers should guard this
  const validValues: AvoidOption[] = ['tolls', 'highways', 'ferries', 'indoor'];
  const filtered = avoids.filter((a) => validValues.includes(a));
  return filtered.length > 0 ? filtered.join('|') : null;
}

/**
 * Build the `transit_mode` query-string value from an array of TransitMode.
 * Multiple values joined with '|'.
 * e.g. ['bus', 'subway'] → 'bus|subway'
 */
function buildTransitModeParam(modes: TransitMode[] | undefined): string | null {
  if (!modes || modes.length === 0) return null;
  return modes.join('|');
}

/**
 * Validate and sanitise the departureTime field.
 * Accepts "now" or a positive integer string (Unix seconds).
 * Returns null for any invalid input to avoid injection.
 */
function sanitiseDepartureTime(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw === 'now') return 'now';
  // Must be a positive integer
  const n = parseInt(raw, 10);
  if (!isNaN(n) && n > 0 && String(n) === raw) return String(n);
  return null;
}

// ── Main handler ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ══════════════════════════════════════════════════════════
  //   KILL SWITCH — Block all calls when quota is exhausted
  //   to prevent billing charges beyond the free tier.
  // ══════════════════════════════════════════════════════════
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

  // ── Validate API key ───────────────────────────────────────
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

  // ── Parse & validate request body ─────────────────────────
  let body: CalculateRequest;
  try {
    body = (await request.json()) as CalculateRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    origin,
    destinations,
    travelMode,
    avoidOptions,
    transitModes,
    transitPreference,
    trafficModel,
    departureTime,
  } = body;

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

  // ── Derive Google API parameters ───────────────────────────
  const googleMode = toGoogleMode(travelMode);
  // indoor avoid is only meaningful for walking / transit — strip it otherwise
  const effectiveAvoidOptions: AvoidOption[] | undefined =
    googleMode !== 'walking' && googleMode !== 'transit'
      ? avoidOptions?.filter((a) => a !== 'indoor')
      : avoidOptions;
  const effectiveAvoidParam = buildAvoidParam(effectiveAvoidOptions);

  const transitModeParam     = googleMode === 'transit' ? buildTransitModeParam(transitModes) : null;
  const transitPrefParam: TransitRoutingPreference | null =
    googleMode === 'transit' ? (transitPreference ?? null) : null;

  // trafficModel & departureTime only relevant for driving/motorcycle
  const safeDepartureTime =
    (googleMode === 'driving')
      ? sanitiseDepartureTime(departureTime)
      : null;
  const effectiveTrafficModel: TrafficModel | null =
    safeDepartureTime && googleMode === 'driving' ? (trafficModel ?? 'best_guess') : null;

  // ── Geocode the origin for map centering ──────────────────
  let originCoords: { lat: number; lng: number } | undefined;
  try {
    const p = new URLSearchParams({
      address:  origin,
      key:      apiKey,
      language: 'zh-TW',
    });
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${p}`);
    const data = await res.json();
    // Count geocode call against quota (1 request)
    incrementQuota(1);
    if (data.status === 'OK' && data.results?.[0]) {
      originCoords = data.results[0].geometry.location as { lat: number; lng: number };
    }
  } catch {
    // Non-fatal — map will centre on the first successful route leg start location
  }

  // ── Fetch each route from Google Directions API ───────────
  const routes: RouteResult[] = [];

  for (let i = 0; i < destinations.length; i++) {
    // Re-check kill switch before EVERY individual API call to stop mid-batch
    if (isQuotaExhausted()) {
      routes.push({
        locationId:   destinations[i].id,
        address:      destinations[i].address,
        index:        i + 1,
        distance:     'N/A',
        distanceValue: 0,
        duration:     'N/A',
        status:       'error',
        errorMessage: 'Quota exhausted — this destination was not calculated.',
        color:        ROUTE_COLORS[i % ROUTE_COLORS.length],
        travelMode,
      });
      continue;
    }

    const dest = destinations[i];

    // Build query parameters for the Directions API call
    const params = new URLSearchParams({
      origin:      origin,
      destination: dest.address,
      key:         apiKey,
      language:    'zh-TW',
      mode:        googleMode,
    });

    // Avoid options (e.g. tolls|highways|ferries)
    if (effectiveAvoidParam) params.set('avoid', effectiveAvoidParam);

    // Transit sub-options (only when mode=transit)
    if (transitModeParam)  params.set('transit_mode', transitModeParam);
    if (transitPrefParam)  params.set('transit_routing_preference', transitPrefParam);

    // Driving traffic options
    if (safeDepartureTime)     params.set('departure_time', safeDepartureTime);
    if (effectiveTrafficModel) params.set('traffic_model', effectiveTrafficModel);

    try {
      const res  = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?${params}`,
      );
      const data = await res.json();
      // Count this Directions API call against quota
      incrementQuota(1);

      if (data.status === 'OK' && data.routes?.length > 0) {
        const route = data.routes[0];
        const leg   = route.legs[0];
        const distanceKm = (leg.distance.value / 1000).toFixed(1);

        // Fallback: use leg start_location as origin coords if geocoding failed
        if (!originCoords && leg.start_location) {
          originCoords = leg.start_location as { lat: number; lng: number };
        }

        routes.push({
          locationId:   dest.id,
          address:      dest.address,
          index:        i + 1,
          distance:     `${distanceKm} km`,
          distanceValue: leg.distance.value,
          duration:     leg.duration.text,
          // duration_in_traffic is present only when departure_time was supplied
          durationInTraffic: leg.duration_in_traffic?.text ?? undefined,
          status:       'success',
          encodedPolyline: route.overview_polyline.points as string,
          color:        ROUTE_COLORS[i % ROUTE_COLORS.length],
          startLocation: leg.start_location as { lat: number; lng: number },
          endLocation:   leg.end_location   as { lat: number; lng: number },
          travelMode,
        });
      } else {
        routes.push({
          locationId:    dest.id,
          address:       dest.address,
          index:         i + 1,
          distance:      'N/A',
          distanceValue: 0,
          duration:      'N/A',
          status:        'error',
          errorMessage:  `Google Maps: ${data.status ?? 'Unknown error'}`,
          color:         ROUTE_COLORS[i % ROUTE_COLORS.length],
          travelMode,
        });
      }
    } catch {
      routes.push({
        locationId:    dest.id,
        address:       dest.address,
        index:         i + 1,
        distance:      'N/A',
        distanceValue: 0,
        duration:      'N/A',
        status:        'error',
        errorMessage:  'Network error while fetching route.',
        color:         ROUTE_COLORS[i % ROUTE_COLORS.length],
        travelMode,
      });
    }
  }

  return NextResponse.json({
    routes,
    quotaStatus: getQuotaStatus(),
    originCoords,
  });
}
