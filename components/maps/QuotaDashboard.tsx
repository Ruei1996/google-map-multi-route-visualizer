'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert, BarChart3 } from 'lucide-react';
import type { QuotaStatus } from '@/types/maps';

interface Props {
  /** Called when quota status changes (e.g. to trigger warning modal) */
  onQuotaUpdate?: (status: QuotaStatus) => void;
  /** Refresh interval in ms. Defaults to 30 000. */
  refreshInterval?: number;
}

export default function QuotaDashboard({
  onQuotaUpdate,
  refreshInterval = 30_000,
}: Props) {
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch('/api/maps/quota');
      if (!res.ok) return;
      const data: QuotaStatus = await res.json();
      setQuota(data);
      setLastFetched(new Date());
      onQuotaUpdate?.(data);
    } catch {
      // silently ignore network errors
    } finally {
      setLoading(false);
    }
  }, [onQuotaUpdate]);

  useEffect(() => {
    fetchQuota();
    const id = setInterval(fetchQuota, refreshInterval);
    return () => clearInterval(id);
  }, [fetchQuota, refreshInterval]);

  if (loading || !quota) {
    return (
      <div className="h-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
    );
  }

  /* ── colour palette based on usage level ── */
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

  const bgAccent = quota.isExhausted
    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    : quota.isWarning
      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700';

  return (
    <div className={`rounded-xl border px-4 py-3 ${bgAccent} transition-colors duration-300`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Icon + label */}
        <div className="flex items-center gap-2 shrink-0">
          {quota.isExhausted ? (
            <ShieldAlert className={`w-4 h-4 ${textAccent}`} />
          ) : quota.isWarning ? (
            <AlertTriangle className={`w-4 h-4 ${textAccent}`} />
          ) : (
            <BarChart3 className={`w-4 h-4 ${textAccent}`} />
          )}
          <span className={`text-sm font-semibold ${textAccent}`}>
            {quota.isExhausted
              ? '⛔ 額度已耗盡'
              : quota.isWarning
                ? '⚠️ 額度即將耗盡'
                : 'API 免費額度'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex-1 min-w-32">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>
              {quota.used.toLocaleString()} / {quota.limit.toLocaleString()} 次
            </span>
            <span>{quota.percentage.toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${quota.percentage}%` }}
            />
          </div>
        </div>

        {/* Remaining + refresh */}
        <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500 dark:text-slate-400">
          <span>剩餘 {quota.remaining.toLocaleString()} 次</span>
          <button
            onClick={fetchQuota}
            title="重新整理額度狀態"
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          {lastFetched && (
            <span className="hidden sm:inline">
              更新於 {lastFetched.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
