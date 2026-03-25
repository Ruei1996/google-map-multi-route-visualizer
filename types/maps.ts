// ============================================================
// Google Maps Multi-Route Distance Calculator — Type Definitions
// ============================================================

/** A single destination location (GPS or street address) */
export interface Location {
  id: string;
  address: string; // Either "lat,lng" or a human-readable address
}

// ── Travel Mode ────────────────────────────────────────────
/**
 * Travel modes supported by the Google Directions API.
 * Note: 'motorcycle' is handled as 'driving' on the backend
 * since the standard REST Directions API does not expose a
 * separate motorcycle routing mode for Taiwan/most regions.
 */
export type TravelMode =
  | 'driving'    // 開車（汽車）
  | 'motorcycle' // 機車 → falls back to driving on backend
  | 'transit'    // 大眾運輸
  | 'walking'    // 步行
  | 'bicycling'; // 騎單車

// ── Avoid Options ──────────────────────────────────────────
/**
 * Route avoidance options passed to the Google Directions API
 * via the `avoid` parameter (multiple values joined with '|').
 */
export type AvoidOption =
  | 'tolls'     // 避開收費路段
  | 'highways'  // 避開高速公路
  | 'ferries'   // 避開渡輪
  | 'indoor';   // 避開室內路線（步行 / 大眾運輸）

// ── Transit Sub-Options ────────────────────────────────────
/**
 * Preferred transit vehicle types when travelMode === 'transit'.
 * Maps to the `transit_mode` query parameter.
 */
export type TransitMode =
  | 'bus'     // 公車
  | 'subway'  // 捷運 / 地鐵
  | 'train'   // 火車 / 高鐵
  | 'tram'    // 輕軌
  | 'rail';   // 所有鐵路（= train + tram + subway）

/**
 * Routing preference when travelMode === 'transit'.
 * Maps to the `transit_routing_preference` query parameter.
 */
export type TransitRoutingPreference = 'less_walking' | 'fewer_transfers';

// ── Driving Extra Options ─────────────────────────────────
/**
 * Traffic model used for duration estimation when travelMode === 'driving'.
 * Requires a `departure_time` to be effective.
 * Maps to the `traffic_model` query parameter.
 */
export type TrafficModel = 'best_guess' | 'pessimistic' | 'optimistic';

// ── Route Result ──────────────────────────────────────────
/** The result of a single origin → destination route calculation */
export interface RouteResult {
  locationId: string;
  address: string;
  index: number;          // 1-based display index (#1 ~ #N)
  distance: string;       // e.g. "12.3 km"
  distanceValue: number;  // raw meters (0 if error)
  duration: string;       // e.g. "25 分鐘"
  durationInTraffic?: string; // e.g. "32 分鐘（含路況）" — only when traffic model is used
  status: 'success' | 'error';
  errorMessage?: string;
  encodedPolyline?: string; // Google's encoded polyline for map rendering
  color: string;            // hex colour for this route's polyline & marker
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
  travelMode?: TravelMode;  // echoed back from the request
}

// ── Quota Status ──────────────────────────────────────────
/** Live snapshot of the API quota counter */
export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;   // 0–100
  isExhausted: boolean;
  isWarning: boolean;   // remaining ≤ 10 % of limit
  lastReset: string;    // ISO date string
}

/**
 * Per-API-type quota snapshot.
 * Tracks usage separately for each Google Maps API type
 * (Directions API, Geocoding API, etc.)
 */
export interface ApiTypeQuota {
  apiType: string;
  displayName: string;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;      // 0–100
  isExhausted: boolean;
  isWarning: boolean;      // remaining ≤ 10 % of limit
  costPer1000: number;     // USD per 1,000 requests
  freeCreditUsd: number;   // monthly free credit in USD
}

/**
 * Aggregated quota status including per-type breakdown.
 * Returned by GET /api/maps/quota and included in calculate responses.
 */
export interface QuotaStatusByType {
  /** Per-API-type breakdown (Directions API, Geocoding API, etc.) */
  byType: ApiTypeQuota[];
  /** Legacy combined quota for backward compatibility with existing callers */
  combined: QuotaStatus;
  /** True when ANY single API type is exhausted */
  isAnyExhausted: boolean;
  /** True when ANY single API type is at warning level (≤ 10% remaining) */
  isAnyWarning: boolean;
  /** Indicates which storage backend provided this data */
  storageBackend: 'supabase' | 'memory';
}

// ── Request / Response ─────────────────────────────────────
/** POST /api/maps/calculate — request body */
export interface CalculateRequest {
  origin: string;
  destinations: Location[];

  // ── Optional routing parameters ──
  /** Travel mode (default: 'driving') */
  travelMode?: TravelMode;
  /** Avoid options — multiple values ANDed together */
  avoidOptions?: AvoidOption[];

  // ── Transit-specific (only used when travelMode === 'transit') ──
  /** Preferred transit vehicle types */
  transitModes?: TransitMode[];
  /** Routing preference for transit */
  transitPreference?: TransitRoutingPreference;

  // ── Driving-specific ──
  /** Traffic model for realistic ETA (requires departure_time) */
  trafficModel?: TrafficModel;
  /**
   * Unix timestamp (seconds) or "now".
   * Enables duration_in_traffic in the response.
   */
  departureTime?: string;
}

/** POST /api/maps/calculate — response body */
export interface CalculateResponse {
  routes: RouteResult[];
  /** Legacy combined quota status (always present for backward compatibility) */
  quotaStatus: QuotaStatus;
  /** Full per-API-type quota breakdown (present when Supabase is enabled or always from quota-service) */
  quotaStatusByType?: QuotaStatusByType;
  originCoords?: { lat: number; lng: number };
}
