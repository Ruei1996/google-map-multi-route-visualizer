// ============================================================
// Google Maps Multi-Route Distance Calculator — Type Definitions
// ============================================================

/** A single destination location (GPS or street address) */
export interface Location {
  id: string;
  address: string; // Either "lat,lng" or a human-readable address
}

/** The result of a single origin → destination route calculation */
export interface RouteResult {
  locationId: string;
  address: string;
  index: number; // 1-based display index (#1 ~ #N)
  distance: string; // e.g. "12.3 km"
  distanceValue: number; // raw meters (0 if error)
  duration: string; // e.g. "25 mins"
  status: 'success' | 'error';
  errorMessage?: string;
  encodedPolyline?: string; // Google's encoded polyline for map rendering
  color: string; // hex color for this route's polyline & marker
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
}

/** Live snapshot of the API quota counter */
export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  percentage: number; // 0–100
  isExhausted: boolean;
  isWarning: boolean; // remaining ≤ 10 % of limit
  lastReset: string; // ISO date string
}

/** POST /api/maps/calculate — request body */
export interface CalculateRequest {
  origin: string;
  destinations: Location[];
}

/** POST /api/maps/calculate — response body */
export interface CalculateResponse {
  routes: RouteResult[];
  quotaStatus: QuotaStatus;
  originCoords?: { lat: number; lng: number };
}
