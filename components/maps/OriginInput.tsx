'use client';

import { MapPin, Info } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function OriginInput({ value, onChange, disabled }: Props) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 shadow-sm">
          <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </div>
        <label
          htmlFor="origin-input"
          className="text-sm font-semibold text-slate-700 dark:text-slate-200"
        >
          出發基準點
        </label>
      </div>

      <div className="relative">
        <input
          id="origin-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="輸入門牌地址或 GPS 座標（例：25.0330,121.5654）"
          className="
            w-full px-4 py-3 pr-10 rounded-xl text-sm
            border border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-800
            text-slate-900 dark:text-slate-100
            placeholder-slate-400 dark:placeholder-slate-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-150
          "
        />
      </div>

      <div className="flex items-start gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400">
        <Info className="w-3 h-3 mt-0.5 shrink-0" />
        <span>
          支援標準地址（如 302新竹縣竹北市福興路757號）或 GPS 格式（lat,lng）
        </span>
      </div>
    </section>
  );
}
