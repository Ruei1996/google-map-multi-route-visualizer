'use client';

import { CheckCircle2, XCircle, ArrowUpDown, Download } from 'lucide-react';
import type { RouteResult } from '@/types/maps';

interface Props {
  routes: RouteResult[];
  origin: string;
}

export default function ResultsTable({ routes, origin }: Props) {
  if (routes.length === 0) return null;

  const successful = routes.filter((r) => r.status === 'success');
  const failed = routes.filter((r) => r.status === 'error');

  /* ── CSV export ── */
  const exportCSV = () => {
    const header = ['#', '目標地點', '距離 (km)', '時間', '狀態'];
    const rows = routes.map((r) => [
      r.index,
      `"${r.address.replace(/"/g, '""')}"`,
      r.status === 'success' ? r.distance.replace(' km', '') : 'N/A',
      r.status === 'success' ? r.duration : 'N/A',
      r.status === 'success' ? '成功' : `失敗: ${r.errorMessage ?? ''}`,
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `routes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            計算結果
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-medium">
            {successful.length} 成功
          </span>
          {failed.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-medium">
              {failed.length} 失敗
            </span>
          )}
        </div>

        <button
          onClick={exportCSV}
          title="匯出 CSV"
          className="
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            border border-slate-200 dark:border-slate-700
            text-slate-600 dark:text-slate-400
            hover:bg-slate-50 dark:hover:bg-slate-800
            transition-colors duration-150
          "
        >
          <Download className="w-3.5 h-3.5" />
          匯出 CSV
        </button>
      </div>

      {/* Origin info */}
      <div className="mb-3 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs text-green-800 dark:text-green-400 flex items-center gap-1.5">
        <span className="font-semibold">📍 基準點：</span>
        <span className="truncate">{origin}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 w-10">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">目標地點</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 w-28">距離</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 w-24">時間</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 w-16">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {routes.map((route) => (
                <tr
                  key={route.locationId}
                  className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {/* Index */}
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: route.color }}
                    >
                      {route.index}
                    </div>
                  </td>

                  {/* Address */}
                  <td className="px-4 py-3">
                    <span className="text-slate-800 dark:text-slate-200 break-words leading-snug">
                      {route.address}
                    </span>
                    {route.status === 'error' && route.errorMessage && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                        {route.errorMessage}
                      </p>
                    )}
                  </td>

                  {/* Distance */}
                  <td className="px-4 py-3 text-right">
                    {route.status === 'success' ? (
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {route.distance}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600">—</span>
                    )}
                  </td>

                  {/* Duration */}
                  <td className="px-4 py-3 text-right">
                    {route.status === 'success' ? (
                      <span className="text-slate-600 dark:text-slate-400">{route.duration}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    {route.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {routes.map((route) => (
            <div
              key={route.locationId}
              className="p-4 bg-white dark:bg-slate-900"
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: route.color }}
                >
                  {route.index}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-200 break-words leading-snug">
                    {route.address}
                  </p>
                  {route.status === 'success' ? (
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {route.distance}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {route.duration}
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1.5">
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-xs text-red-500">
                        {route.errorMessage ?? '計算失敗'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
