'use client';

import { Plus, Trash2, MapPin, GripVertical } from 'lucide-react';
import type { Location } from '@/types/maps';

interface Props {
  locations: Location[];
  onChange: (locations: Location[]) => void;
  disabled?: boolean;
  routeColors?: Record<string, string>;
}

let idCounter = 0;
function genId() {
  return `loc-${Date.now()}-${++idCounter}`;
}

export default function LocationTable({
  locations,
  onChange,
  disabled,
  routeColors = {},
}: Props) {
  /* ── mutations ── */
  const addLocation = () => {
    onChange([...locations, { id: genId(), address: '' }]);
  };

  const updateAddress = (id: string, address: string) => {
    onChange(locations.map((l) => (l.id === id ? { ...l, address } : l)));
  };

  const removeLocation = (id: string) => {
    onChange(locations.filter((l) => l.id !== id));
  };

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 shadow-sm">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            目標地點列表
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-medium">
            {locations.length} 個
          </span>
        </div>

        <button
          onClick={addLocation}
          disabled={disabled}
          className="
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
            bg-blue-500 hover:bg-blue-600 text-white
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150 shadow-sm
          "
        >
          <Plus className="w-4 h-4" />
          新增地點
        </button>
      </div>

      {/* Table / list */}
      {locations.length === 0 ? (
        <div className="
          flex flex-col items-center justify-center gap-2
          py-8 rounded-xl border-2 border-dashed
          border-slate-300 dark:border-slate-700
          text-slate-400 dark:text-slate-500
        ">
          <MapPin className="w-8 h-8 opacity-40" />
          <p className="text-sm">尚未新增目標地點</p>
          <button
            onClick={addLocation}
            disabled={disabled}
            className="text-sm text-blue-500 hover:underline disabled:opacity-50"
          >
            點此新增第一個地點
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Table header */}
          <div className="
            grid grid-cols-[auto_1fr_auto] gap-0
            bg-slate-50 dark:bg-slate-800/60
            border-b border-slate-200 dark:border-slate-700
            px-3 py-2
          ">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-8">#</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              地址 / GPS 座標
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-8 text-center">
              刪除
            </span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {locations.map((loc, idx) => {
              const color = routeColors[loc.id];
              return (
                <div
                  key={loc.id}
                  className="
                    grid grid-cols-[auto_1fr_auto] items-center gap-2
                    px-3 py-2
                    bg-white dark:bg-slate-900
                    hover:bg-slate-50 dark:hover:bg-slate-800/50
                    transition-colors duration-100
                    group
                  "
                >
                  {/* Index badge */}
                  <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0"
                    style={
                      color
                        ? { backgroundColor: color, color: '#fff' }
                        : { backgroundColor: '#e2e8f0', color: '#475569' }
                    }
                  >
                    {idx + 1}
                  </div>

                  {/* Address input */}
                  <input
                    type="text"
                    value={loc.address}
                    onChange={(e) => updateAddress(loc.id, e.target.value)}
                    disabled={disabled}
                    placeholder={`目標 #${idx + 1}：地址或 lat,lng`}
                    className="
                      w-full text-sm px-2 py-1.5 rounded-lg
                      bg-transparent
                      text-slate-800 dark:text-slate-200
                      placeholder-slate-400 dark:placeholder-slate-500
                      border border-transparent
                      focus:border-blue-400 dark:focus:border-blue-500
                      focus:bg-white dark:focus:bg-slate-800
                      focus:outline-none focus:ring-1 focus:ring-blue-400
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-150
                    "
                  />

                  {/* Delete button */}
                  <button
                    onClick={() => removeLocation(loc.id)}
                    disabled={disabled}
                    aria-label={`刪除地點 #${idx + 1}`}
                    className="
                      flex items-center justify-center
                      w-7 h-7 rounded-lg shrink-0
                      text-slate-400 hover:text-red-500
                      hover:bg-red-50 dark:hover:bg-red-900/30
                      disabled:opacity-30 disabled:cursor-not-allowed
                      transition-all duration-150
                      opacity-0 group-hover:opacity-100
                      focus:opacity-100
                    "
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
