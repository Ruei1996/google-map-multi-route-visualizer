'use client';

/**
 * QuotaDashboard — Real-time API quota usage display.
 *
 * Features:
 *  • Shows SEPARATE progress bars for each Google Maps API type
 *    (Directions API, Geocoding API, etc.)
 *  • Displays used / limit / remaining / percentage per API type
 *  • Color-coded status: red (exhausted), amber (warning ≤10%), blue (healthy)
 *  • Storage backend indicator: Supabase cloud vs. in-memory fallback
 *  • Auto-refreshes every 30 seconds (configurable via refreshInterval prop)
 *  • Cost information shown per API type ($X per 1,000 calls)
 *  • Calls onQuotaUpdate with the combined status for backward compatibility
 *    with the parent page's warning modal logic
 */

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert, BarChart3, Cloud, Server } from 'lucide-react';
import type { QuotaStatus, QuotaStatusByType, ApiTypeQuota } from '@/types/maps';

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  /**
   * Called when quota status changes.
   * Receives the COMBINED quota for backward compatibility with the warning
   * modal logic in the parent page.
   */
  onQuotaUpdate?: (status: QuotaStatus) => void;
  /** Auto-refresh interval in milliseconds. Defaults to 30,000 (30 seconds). */
  refreshInterval?: number;
}

// ── Sub-component: single API type row ────────────────────────────────────

/**
 * Renders a single progress-bar row for one API type.
 * Shows: display name, used/limit counts, percentage bar, cost info.
 */
function ApiTypeRow({ quota }: { quota: ApiTypeQuota }) {
  // Pick colour based on status level
  const barColor = quota.isExhausted
    ? 'bg-red-500'
    : quota.isWarning
      ? 'bg-amber-500'
      : 'bg-blue-500';

  const textAccent = quota.isExhausted
    ? 'text-red-600 dark:text-red-400'
    : quota.isWarning
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-blue-600 dark:text-blue-400';

  const statusLabel = quota.isExhausted
    ? '⛔ 已耗盡'
    : quota.isWarning
      ? '⚠️ 即將耗盡'
      : '正常';

  return (
    <div className="flex flex-col gap-1.5">
      {/* Row header: API name + status + cost */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {quota.displayName}
          </span>
          <span className={`text-[10px] font-medium ${textAccent}`}>
            {statusLabel}
          </span>
        </div>
        {/* Cost info — shown as a subtle hint */}
        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
          ${quota.costPer1000}/1,000 · 免費額度 ${quota.freeCreditUsd}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${quota.percentage}%` }}
          />
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 w-10 text-right tabular-nums">
          {quota.percentage.toFixed(1)}%
        </span>
      </div>

      {/* Usage counts */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span>
          已使用 <span className="font-medium text-slate-600 dark:text-slate-300">
            {quota.used.toLocaleString()}
          </span>{' '}
          / {quota.limit.toLocaleString()} 次
        </span>
        <span>
          剩餘{' '}
          <span className={`font-medium ${textAccent}`}>
            {quota.remaining.toLocaleString()}
          </span>{' '}
          次
        </span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function QuotaDashboard({
  onQuotaUpdate,
  refreshInterval = 30_000,
}: Props) {
  const [quotaByType, setQuotaByType]   = useState<QuotaStatusByType | null>(null);
  const [loading, setLoading]           = useState(true);
  const [lastFetched, setLastFetched]   = useState<Date | null>(null);

  /**
   * Fetch fresh quota data from /api/maps/quota.
   * The API now returns a full QuotaStatusByType object.
   * After updating state, call onQuotaUpdate with the combined quota
   * so the parent page's warning modal logic still works.
   */
  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch('/api/maps/quota');
      if (!res.ok) return;

      // The API now returns QuotaStatusByType
      const data = await res.json() as QuotaStatusByType;
      setQuotaByType(data);
      setLastFetched(new Date());

      // Notify parent with combined quota for backward compat
      if (data.combined) {
        onQuotaUpdate?.(data.combined);
      }
    } catch {
      // Silently ignore network errors — the UI will keep showing stale data
    } finally {
      setLoading(false);
    }
  }, [onQuotaUpdate]);

  // Fetch on mount and set up auto-refresh interval
  useEffect(() => {
    fetchQuota();
    const id = setInterval(fetchQuota, refreshInterval);
    return () => clearInterval(id);
  }, [fetchQuota, refreshInterval]);

  // ── Loading skeleton ────────────────────────────────────────
  if (loading || !quotaByType) {
    return (
      <div className="h-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
    );
  }

  // ── Derive overall container style from worst-case API status ──
  const isExhausted = quotaByType.isAnyExhausted;
  const isWarning   = quotaByType.isAnyWarning && !isExhausted;

  const containerBg = isExhausted
    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    : isWarning
      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700';

  const headerTextAccent = isExhausted
    ? 'text-red-600 dark:text-red-400'
    : isWarning
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-blue-600 dark:text-blue-400';

  // ── Header icon based on worst status ──────────────────────
  const HeaderIcon = isExhausted
    ? ShieldAlert
    : isWarning
      ? AlertTriangle
      : BarChart3;

  // ── Storage backend indicator ──────────────────────────────
  const isSupabase = quotaByType.storageBackend === 'supabase';

  return (
    <div className={`rounded-xl border px-4 py-3 ${containerBg} transition-colors duration-300`}>

      {/* ── Top row: title + storage backend + refresh ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3">

        {/* Status icon + title */}
        <div className="flex items-center gap-2 shrink-0">
          <HeaderIcon className={`w-4 h-4 ${headerTextAccent}`} />
          <span className={`text-sm font-semibold ${headerTextAccent}`}>
            {isExhausted
              ? '⛔ 額度已耗盡'
              : isWarning
                ? '⚠️ 額度即將耗盡'
                : 'API 免費額度'}
          </span>
        </div>

        {/* Storage backend badge — shows where data is coming from */}
        <div
          className={[
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0',
            isSupabase
              ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400'
              : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400',
          ].join(' ')}
          title={isSupabase
            ? 'Supabase 雲端儲存 — 跨實例共享、重啟後保留'
            : '記憶體儲存 — 設定 SUPABASE_URL 以啟用雲端儲存'}
        >
          {isSupabase
            ? <><Cloud className="w-2.5 h-2.5" /> Supabase</>
            : <><Server className="w-2.5 h-2.5" /> 記憶體</>}
        </div>

        {/* Spacer pushes refresh controls to the right */}
        <div className="flex-1" />

        {/* Last-fetched time + refresh button */}
        <div className="flex items-center gap-2 shrink-0 text-xs text-slate-500 dark:text-slate-400">
          {lastFetched && (
            <span className="hidden sm:inline">
              更新於 {lastFetched.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchQuota}
            title="重新整理額度狀態"
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── Per-API-type progress rows ── */}
      <div className="flex flex-col gap-3">
        {quotaByType.byType.map((apiQuota) => (
          <ApiTypeRow key={apiQuota.apiType} quota={apiQuota} />
        ))}
      </div>

    </div>
  );
}
