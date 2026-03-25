'use client';

import { Map } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function AppHeader() {
  return (
    <header className="
      sticky top-0 z-50
      bg-white/80 dark:bg-slate-900/80
      backdrop-blur-md
      border-b border-slate-200 dark:border-slate-700
      shadow-sm
    ">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="
              flex items-center justify-center
              w-9 h-9 rounded-xl
              bg-gradient-to-br from-blue-500 to-blue-700
              shadow-md
            ">
              <Map className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                RouteCalc
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight hidden sm:block">
                多路線距離計算與可視化
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Google Maps Proxy
            </span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
