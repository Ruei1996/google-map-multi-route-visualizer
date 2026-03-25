'use client';

/**
 * TravelOptions — Travel mode selector + route-avoid checkboxes.
 *
 * Mirrors the routing options available in Google Maps:
 *   • Travel mode  : 開車 / 機車 / 大眾運輸 / 步行 / 騎單車
 *   • Avoid        : 高速公路 / 收費路段 / 渡輪 / 室內路線
 *   • Transit opts : preferred vehicle types + routing preference
 *
 * Note on 機車 (motorcycle):
 *   Google's REST Directions API does not expose a separate motorcycle
 *   routing mode for most regions.  The backend maps it to 'driving' so
 *   route geometry is the same; the distinction is purely a UX label.
 */

import { type Dispatch, type SetStateAction } from 'react';
import type {
  TravelMode,
  AvoidOption,
  TransitMode,
  TransitRoutingPreference,
} from '@/types/maps';

// ── Sub-types for the aggregated options object ──────────────
export interface TravelOptionsState {
  travelMode:         TravelMode;
  avoidOptions:       AvoidOption[];
  transitModes:       TransitMode[];
  transitPreference:  TransitRoutingPreference | '';
}

export const DEFAULT_TRAVEL_OPTIONS: TravelOptionsState = {
  travelMode:        'driving',
  avoidOptions:      [],
  transitModes:      [],
  transitPreference: '',
};

// ── Travel mode definitions ───────────────────────────────────
interface ModeConfig {
  value:    TravelMode;
  label:    string;
  emoji:    string;
  note?:    string; // shown as tooltip
}

const MODES: ModeConfig[] = [
  { value: 'driving',   label: '開車',     emoji: '🚗' },
  { value: 'motorcycle',label: '機車',     emoji: '🏍️', note: '路線與開車相同（Google API 限制）' },
  { value: 'transit',   label: '大眾運輸', emoji: '🚌' },
  { value: 'walking',   label: '步行',     emoji: '🚶' },
  { value: 'bicycling', label: '騎單車',   emoji: '🚲' },
];

// ── Avoid option definitions ──────────────────────────────────
interface AvoidConfig {
  value:    AvoidOption;
  label:    string;
  emoji:    string;
  /** Only show when one of these modes is active (undefined = always visible) */
  modes?:   TravelMode[];
}

const AVOID_OPTIONS: AvoidConfig[] = [
  { value: 'highways', label: '避開高速公路', emoji: '🛣️' },
  { value: 'tolls',    label: '避開收費路段', emoji: '💰' },
  { value: 'ferries',  label: '避開渡輪',     emoji: '⛴️' },
  {
    value: 'indoor',
    label: '避開室內路線',
    emoji: '🏠',
    // indoor avoid is only relevant for walking / transit
    modes: ['walking', 'transit'],
  },
];

// ── Transit vehicle type options ──────────────────────────────
interface TransitConfig {
  value: TransitMode;
  label: string;
  emoji: string;
}

const TRANSIT_MODES: TransitConfig[] = [
  { value: 'bus',    label: '公車',   emoji: '🚌' },
  { value: 'subway', label: '捷運',   emoji: '🚇' },
  { value: 'train',  label: '火車',   emoji: '🚆' },
  { value: 'tram',   label: '輕軌',   emoji: '🚃' },
];

// ── Props ─────────────────────────────────────────────────────
interface Props {
  options:    TravelOptionsState;
  onChange:   Dispatch<SetStateAction<TravelOptionsState>>;
  disabled?:  boolean;
}

// ── Component ─────────────────────────────────────────────────
export default function TravelOptions({ options, onChange, disabled = false }: Props) {
  const { travelMode, avoidOptions, transitModes, transitPreference } = options;

  /** Toggle a single AvoidOption in/out of the array */
  const toggleAvoid = (opt: AvoidOption) => {
    onChange((prev) => ({
      ...prev,
      avoidOptions: prev.avoidOptions.includes(opt)
        ? prev.avoidOptions.filter((o) => o !== opt)
        : [...prev.avoidOptions, opt],
    }));
  };

  /** Toggle a single TransitMode in/out of the array */
  const toggleTransitMode = (mode: TransitMode) => {
    onChange((prev) => ({
      ...prev,
      transitModes: prev.transitModes.includes(mode)
        ? prev.transitModes.filter((m) => m !== mode)
        : [...prev.transitModes, mode],
    }));
  };

  /** Visible avoid options depend on the currently selected travel mode */
  const visibleAvoids = AVOID_OPTIONS.filter(
    (a) => !a.modes || a.modes.includes(travelMode),
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── Section title ── */}
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        交通選項
      </div>

      {/* ══════════════════════════════════════════
           Travel Mode — pill buttons
         ══════════════════════════════════════════ */}
      <div>
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
          交通方式
        </div>
        <div className="flex flex-wrap gap-2">
          {MODES.map((mode) => {
            const isActive = travelMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                title={mode.note}
                disabled={disabled}
                onClick={() =>
                  onChange((prev) => ({ ...prev, travelMode: mode.value }))
                }
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                  'border transition-all duration-150 select-none',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  isActive
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400',
                ].join(' ')}
              >
                <span role="img" aria-label={mode.label}>{mode.emoji}</span>
                {mode.label}
                {/* Tiny note icon when there's a limitation note */}
                {mode.note && (
                  <span className="opacity-50 text-[10px]" title={mode.note}>ⓘ</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════
           Route Avoid Options — checkboxes
         ══════════════════════════════════════════ */}
      {visibleAvoids.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            路徑選項
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {visibleAvoids.map((opt) => {
              const checked = avoidOptions.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={[
                    'flex items-center gap-2 cursor-pointer select-none',
                    'text-xs text-slate-600 dark:text-slate-300',
                    disabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-slate-900 dark:hover:text-slate-100',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleAvoid(opt.value)}
                    className="
                      w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600
                      text-blue-600 focus:ring-blue-500 focus:ring-offset-0
                      bg-white dark:bg-slate-800
                      cursor-pointer disabled:cursor-not-allowed
                    "
                  />
                  <span>{opt.emoji} {opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
           Transit Sub-Options (only for 大眾運輸)
         ══════════════════════════════════════════ */}
      {travelMode === 'transit' && (
        <>
          {/* Preferred vehicle types */}
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              偏好交通工具
              <span className="ml-1 text-slate-400 dark:text-slate-600 font-normal">（不選則全部）</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TRANSIT_MODES.map((tm) => {
                const isActive = transitModes.includes(tm.value);
                return (
                  <button
                    key={tm.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleTransitMode(tm.value)}
                    className={[
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                      'border transition-all duration-150',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      isActive
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-400',
                    ].join(' ')}
                  >
                    <span>{tm.emoji}</span>
                    {tm.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Routing preference */}
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              路線偏好
            </div>
            <div className="flex gap-2">
              {(
                [
                  { value: '',                  label: '預設' },
                  { value: 'less_walking',       label: '少走路' },
                  { value: 'fewer_transfers',    label: '少換乘' },
                ] as { value: TransitRoutingPreference | ''; label: string }[]
              ).map((pref) => {
                const isActive = transitPreference === pref.value;
                return (
                  <button
                    key={pref.value}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        transitPreference: pref.value,
                      }))
                    }
                    className={[
                      'px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      isActive
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-400',
                    ].join(' ')}
                  >
                    {pref.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
