'use client';

import { AlertTriangle, X, ShieldAlert } from 'lucide-react';

interface Props {
  type: 'warning' | 'exhausted';
  onClose: () => void;
  used: number;
  limit: number;
  remaining: number;
}

export default function WarningModal({ type, onClose, used, limit, remaining }: Props) {
  const isExhausted = type === 'exhausted';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="warning-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isExhausted ? onClose : undefined}
      />

      {/* Panel */}
      <div className={`
        relative w-full max-w-md rounded-2xl shadow-2xl
        border overflow-hidden
        ${isExhausted
          ? 'bg-white dark:bg-slate-900 border-red-300 dark:border-red-700'
          : 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700'
        }
      `}>
        {/* Coloured stripe at top */}
        <div className={`h-1.5 w-full ${isExhausted ? 'bg-red-500' : 'bg-amber-500'}`} />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className={`
                flex items-center justify-center w-11 h-11 rounded-full
                ${isExhausted
                  ? 'bg-red-100 dark:bg-red-900/40'
                  : 'bg-amber-100 dark:bg-amber-900/40'
                }
              `}>
                {isExhausted ? (
                  <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div>
                <h2
                  id="warning-title"
                  className="text-lg font-bold text-slate-900 dark:text-slate-100"
                >
                  {isExhausted ? '⛔ API 額度已耗盡' : '⚠️ API 額度預警'}
                </h2>
                <p className={`text-sm font-medium ${isExhausted ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {isExhausted ? 'Kill Switch 已啟動' : '剩餘不足 10%'}
                </p>
              </div>
            </div>

            {!isExhausted && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="關閉"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: '已使用', value: used.toLocaleString(), sub: '次' },
              { label: '剩餘', value: remaining.toLocaleString(), sub: '次' },
              { label: '總額度', value: limit.toLocaleString(), sub: '次' },
            ].map(({ label, value, sub }) => (
              <div
                key={label}
                className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-center border border-slate-200 dark:border-slate-700"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {value}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>
              </div>
            ))}
          </div>

          {/* Message */}
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            {isExhausted
              ? '為防止產生額外費用，後端已啟動強制阻擋機制（Kill Switch）。所有計算請求均已被攔截，直到額度重置為止。如需繼續使用，請聯繫系統管理員重置計數器。'
              : '目前免費 API 額度剩餘不足 10%，請節省使用。當額度完全耗盡時，系統將自動啟動 Kill Switch 阻擋所有計算請求。'}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            {isExhausted ? (
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
              >
                我已了解
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                >
                  繼續使用
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl font-semibold text-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  知道了
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
