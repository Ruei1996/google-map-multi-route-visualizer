/**
 * Quota Service — Unified API quota tracking layer.
 *
 * Strategy:
 *  1. When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are configured, all quota
 *     data is persisted in the `api_calls` Supabase table and read via the
 *     `monthly_usage` view. This survives process restarts and works across
 *     multiple serverless instances (e.g. Vercel deployments).
 *  2. When Supabase is NOT configured, the service falls back to the in-memory
 *     quota-store singleton. This is suitable for local development and
 *     single-instance deployments.
 *
 * All public functions handle errors gracefully — a Supabase failure will
 * automatically fall back to in-memory data rather than crashing.
 *
 * SECURITY: This module must only be imported in server-side API routes.
 * It imports from lib/supabase/server.ts which uses the SERVICE_ROLE_KEY.
 */

import { supabaseServer, isSupabaseEnabled } from '@/lib/supabase/server';
import {
  getQuotaStatus,
  incrementQuota,
  resetQuota,
} from '@/lib/maps/quota-store';
import type { QuotaStatus } from '@/types/maps';

// ── Re-exported types (also defined in types/maps.ts) ──────────────────────

/** Per-API-type quota snapshot */
export interface ApiTypeQuota {
  apiType: string;
  displayName: string;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  isExhausted: boolean;
  isWarning: boolean;
  costPer1000: number;
  freeCreditUsd: number;
}

/** Aggregated quota status — includes per-type breakdown and combined totals */
export interface QuotaStatusByType {
  /** Per-API-type breakdown (Directions, Geocoding, etc.) */
  byType: ApiTypeQuota[];
  /** Legacy combined quota for backward compatibility */
  combined: QuotaStatus;
  /** True when ANY api type is exhausted */
  isAnyExhausted: boolean;
  /** True when ANY api type is at warning level (≤ 10% remaining) */
  isAnyWarning: boolean;
  /** Indicates which storage backend provided this data */
  storageBackend: 'supabase' | 'memory';
}

// ── Parameters for logApiCall ──────────────────────────────────────────────

export interface LogApiCallParams {
  apiType: 'directions' | 'geocoding';
  travelMode?: string;
  avoidOptions?: string[];
  status: 'success' | 'error';
  errorCode?: string;
  originQuery?: string;
  destinationQuery?: string;
  sessionId?: string;
}

// ── Internal helper: build ApiTypeQuota from raw DB row ───────────────────

/**
 * Converts a raw row from the `monthly_usage` Supabase view into an
 * `ApiTypeQuota` object with derived fields (isExhausted, isWarning, etc.)
 */
function rowToApiTypeQuota(row: Record<string, unknown>): ApiTypeQuota {
  const limit     = Number(row.monthly_free_requests) || 40000;
  const used      = Number(row.used_this_month)       || 0;
  const remaining = Math.max(0, limit - used);
  const percentage = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return {
    apiType:       String(row.api_type),
    displayName:   String(row.display_name),
    used,
    limit,
    remaining,
    percentage,
    isExhausted:   used >= limit,
    isWarning:     remaining > 0 && remaining <= limit * 0.1,
    costPer1000:   Number(row.cost_per_1000_usd) || 5,
    freeCreditUsd: Number(row.free_credit_usd)   || 200,
  };
}

// ── Internal helper: combine per-type into a legacy QuotaStatus ───────────

/**
 * Aggregates individual API type quotas into a single combined QuotaStatus.
 * Uses the MAXIMUM usage percentage across all types to drive the status flags,
 * so a warning/exhausted state in any single type surfaces to the top level.
 */
function combinedFromByType(byType: ApiTypeQuota[]): QuotaStatus {
  if (byType.length === 0) {
    // Return sensible defaults when no data is available
    return {
      used:        0,
      limit:       40000,
      remaining:   40000,
      percentage:  0,
      isExhausted: false,
      isWarning:   false,
      lastReset:   new Date().toISOString(),
    };
  }

  const totalUsed      = byType.reduce((s, t) => s + t.used,      0);
  const totalLimit     = byType.reduce((s, t) => s + t.limit,     0);
  const totalRemaining = byType.reduce((s, t) => s + t.remaining, 0);
  const percentage     = totalLimit > 0 ? Math.min(100, (totalUsed / totalLimit) * 100) : 0;

  return {
    used:        totalUsed,
    limit:       totalLimit,
    remaining:   totalRemaining,
    percentage,
    isExhausted: byType.some((t) => t.isExhausted),
    isWarning:   byType.some((t) => t.isWarning),
    lastReset:   new Date().toISOString(),
  };
}

// ── Internal helper: fallback memory QuotaStatusByType ────────────────────

/**
 * Builds a QuotaStatusByType from the in-memory quota-store.
 * Uses a single "all APIs" entry since memory tracking is not per-type.
 */
function memoryQuotaStatusByType(): QuotaStatusByType {
  const memStatus = getQuotaStatus();

  // Represent memory as a single synthetic "All APIs" entry
  const syntheticEntry: ApiTypeQuota = {
    apiType:       'all',
    displayName:   'All APIs (Memory)',
    used:          memStatus.used,
    limit:         memStatus.limit,
    remaining:     memStatus.remaining,
    percentage:    memStatus.percentage,
    isExhausted:   memStatus.isExhausted,
    isWarning:     memStatus.isWarning,
    costPer1000:   5,
    freeCreditUsd: 200,
  };

  return {
    byType:          [syntheticEntry],
    combined:        memStatus,
    isAnyExhausted:  memStatus.isExhausted,
    isAnyWarning:    memStatus.isWarning,
    storageBackend:  'memory',
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Log a single Google Maps API call.
 *
 * When Supabase is enabled: inserts a row into the `api_calls` table.
 * When in-memory fallback: increments the in-memory counter.
 *
 * Always resolves — errors are logged but never thrown to the caller.
 *
 * @param params - Details of the API call to record
 */
export async function logApiCall(params: LogApiCallParams): Promise<void> {
  if (isSupabaseEnabled && supabaseServer) {
    try {
      const { error } = await supabaseServer
        .from('api_calls')
        .insert({
          api_type:          params.apiType,
          travel_mode:       params.travelMode        ?? null,
          avoid_options:     params.avoidOptions       ?? null,
          status:            params.status,
          error_code:        params.errorCode          ?? null,
          origin_query:      params.originQuery        ?? null,
          destination_query: params.destinationQuery   ?? null,
          session_id:        params.sessionId          ?? null,
          // called_at defaults to NOW() in the DB schema
        });

      if (error) {
        // Log but do NOT propagate — fall through to memory increment below
        console.error('[quota-service] Supabase insert error:', error.message);
        incrementQuota(1); // keep in-memory in sync as best-effort fallback
      }
      // Success — don't touch in-memory counter when Supabase is primary
    } catch (err) {
      console.error('[quota-service] Unexpected error logging to Supabase:', err);
      incrementQuota(1); // best-effort memory fallback
    }
  } else {
    // In-memory path: simply increment the shared counter
    incrementQuota(1);
  }
}

/**
 * Retrieve per-API-type quota status from Supabase's `monthly_usage` view.
 * Falls back to in-memory store if Supabase is unavailable or returns an error.
 *
 * @returns A QuotaStatusByType with per-type breakdown and combined totals
 */
export async function getQuotaStatusFromDB(): Promise<QuotaStatusByType> {
  if (isSupabaseEnabled && supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('monthly_usage')
        .select('*');

      if (error) {
        console.error('[quota-service] Supabase select error:', error.message);
        return memoryQuotaStatusByType();
      }

      if (!data || data.length === 0) {
        // No rows yet — return zeroed-out defaults for known API types
        const defaultTypes: ApiTypeQuota[] = [
          {
            apiType:       'directions',
            displayName:   'Directions API',
            used:          0,
            limit:         40000,
            remaining:     40000,
            percentage:    0,
            isExhausted:   false,
            isWarning:     false,
            costPer1000:   5,
            freeCreditUsd: 200,
          },
          {
            apiType:       'geocoding',
            displayName:   'Geocoding API',
            used:          0,
            limit:         40000,
            remaining:     40000,
            percentage:    0,
            isExhausted:   false,
            isWarning:     false,
            costPer1000:   5,
            freeCreditUsd: 200,
          },
        ];

        return {
          byType:          defaultTypes,
          combined:        combinedFromByType(defaultTypes),
          isAnyExhausted:  false,
          isAnyWarning:    false,
          storageBackend:  'supabase',
        };
      }

      // Transform rows into typed objects
      const byType = (data as Record<string, unknown>[]).map(rowToApiTypeQuota);
      const combined = combinedFromByType(byType);

      return {
        byType,
        combined,
        isAnyExhausted: byType.some((t) => t.isExhausted),
        isAnyWarning:   byType.some((t) => t.isWarning),
        storageBackend: 'supabase',
      };
    } catch (err) {
      console.error('[quota-service] Unexpected error querying Supabase:', err);
      return memoryQuotaStatusByType();
    }
  }

  // Supabase not configured — use in-memory
  return memoryQuotaStatusByType();
}

/**
 * Returns the aggregated (combined) quota status only.
 * Used for backward-compatible callers that only need a single QuotaStatus.
 *
 * @returns Combined QuotaStatus across all API types
 */
export async function getAggregatedQuotaStatus(): Promise<QuotaStatus> {
  const byTypeStatus = await getQuotaStatusFromDB();
  return byTypeStatus.combined;
}

/**
 * Check whether ANY API type has exhausted its quota.
 * Used as the kill-switch condition in the calculate API route.
 *
 * @returns true if any single API type is at or over its limit
 */
export async function isAnyQuotaExhausted(): Promise<boolean> {
  const status = await getQuotaStatusFromDB();
  return status.isAnyExhausted;
}

/**
 * Reset quota data for the current month.
 *
 * When Supabase is enabled: deletes all api_calls rows for the current
 * calendar month so the monthly_usage view resets to zero.
 *
 * When in-memory: calls resetQuota() from the quota-store.
 *
 * Always resolves — errors are logged but never thrown.
 */
export async function resetQuotaInDB(): Promise<void> {
  if (isSupabaseEnabled && supabaseServer) {
    try {
      // Delete only current-month rows (determined by DATE_TRUNC logic)
      // We use a filter: called_at >= first day of this month
      const now       = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { error } = await supabaseServer
        .from('api_calls')
        .delete()
        .gte('called_at', monthStart);

      if (error) {
        console.error('[quota-service] Supabase reset error:', error.message);
      }
    } catch (err) {
      console.error('[quota-service] Unexpected error resetting Supabase quota:', err);
    }
  }

  // Always also reset in-memory counter (keeps them in sync after reset)
  resetQuota();
}
