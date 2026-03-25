'use client';

import { useState, useCallback, useRef } from 'react';
import { Calculator, RotateCcw, AlertCircle, MapPin, Layers } from 'lucide-react';

import AppHeader from '@/components/maps/AppHeader';
import QuotaDashboard from '@/components/maps/QuotaDashboard';
import OriginInput from '@/components/maps/OriginInput';
import LocationTable from '@/components/maps/LocationTable';
import MapView from '@/components/maps/MapView';
import ResultsTable from '@/components/maps/ResultsTable';
import WarningModal from '@/components/maps/WarningModal';

import type {
  Location,
  RouteResult,
  QuotaStatus,
  CalculateResponse,
} from '@/types/maps';

// ─────────────────────────────────────────────────────────
//  Default demo data so the user can try it right away
// ─────────────────────────────────────────────────────────
const DEMO_ORIGIN = '302新竹縣竹北市福興路757號';
const DEMO_DESTINATIONS: Location[] = [
  { id: 'demo-1', address: '台北市信義區市府路1號' },
  { id: 'demo-2', address: '新竹市東區中正路120號' },
];

type ModalState =
  | { open: false }
  | { open: true; type: 'warning' | 'exhausted'; quota: QuotaStatus };

export default function MapsPage() {
  // ── form state ──
  const [origin, setOrigin] = useState(DEMO_ORIGIN);
  const [destinations, setDestinations] = useState<Location[]>(DEMO_DESTINATIONS);

  // ── result state ──
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | undefined>();

  // ── UI state ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const warningShownRef = useRef(false);
  const exhaustedShownRef = useRef(false);

  // ── quota colour map for the location table badges ──
  const routeColorMap: Record<string, string> = {};
  routes.forEach((r) => {
    routeColorMap[r.locationId] = r.color;
  });

  /* ── Quota update callback from QuotaDashboard ── */
  const handleQuotaUpdate = useCallback((status: QuotaStatus) => {
    if (status.isExhausted && !exhaustedShownRef.current) {
      exhaustedShownRef.current = true;
      setModal({ open: true, type: 'exhausted', quota: status });
    } else if (status.isWarning && !warningShownRef.current && !status.isExhausted) {
      warningShownRef.current = true;
      setModal({ open: true, type: 'warning', quota: status });
    }
  }, []);

  /* ── Calculate routes ── */
  const handleCalculate = async () => {
    const trimmedOrigin = origin.trim();
    const filledDests = destinations.filter((d) => d.address.trim() !== '');

    if (!trimmedOrigin) {
      setError('請輸入出發基準點。');
      return;
    }
    if (filledDests.length === 0) {
      setError('請至少新增一個目標地點。');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/maps/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: trimmedOrigin, destinations: filledDests }),
      });

      const data: CalculateResponse & { error?: string; message?: string } =
        await res.json();

      if (res.status === 429) {
        // Kill switch triggered
        setError(data.message ?? '額度已耗盡，所有請求已被攔截。');
        if (data.quotaStatus) {
          handleQuotaUpdate(data.quotaStatus);
        }
        return;
      }

      if (!res.ok) {
        setError(data.message ?? data.error ?? '伺服器錯誤，請稍後再試。');
        return;
      }

      setRoutes(data.routes ?? []);
      setOriginCoords(data.originCoords);

      // Trigger quota modals if needed
      if (data.quotaStatus) {
        handleQuotaUpdate(data.quotaStatus);
      }

      // Smooth-scroll to map on mobile
      if (window.innerWidth < 1024) {
        setTimeout(() => {
          document.getElementById('map-section')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 200);
      }
    } catch (err) {
      setError('網路錯誤，無法連線至伺服器。請確認您的網路連線後再試。');
    } finally {
      setLoading(false);
    }
  };

  /* ── Reset all ── */
  const handleReset = () => {
    setOrigin('');
    setDestinations([]);
    setRoutes([]);
    setOriginCoords(undefined);
    setError(null);
    warningShownRef.current = false;
    exhaustedShownRef.current = false;
  };

  const hasResults = routes.length > 0;
  const validDestCount = destinations.filter((d) => d.address.trim()).length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* ── Header ── */}
      <AppHeader />

      {/* ── Quota Dashboard ── */}
      <div className="max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <QuotaDashboard onQuotaUpdate={handleQuotaUpdate} refreshInterval={30_000} />
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* ══════════════════════════
               LEFT PANEL — Controls
             ══════════════════════════ */}
          <aside className="w-full lg:w-[420px] xl:w-[460px] shrink-0 flex flex-col gap-4">

            {/* ── Card: Origin + Destinations ── */}
            <div className="
              rounded-2xl border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-900 shadow-sm
              p-5 flex flex-col gap-5
            ">
              <OriginInput value={origin} onChange={setOrigin} disabled={loading} />

              <div className="border-t border-slate-100 dark:border-slate-800" />

              <LocationTable
                locations={destinations}
                onChange={setDestinations}
                disabled={loading}
                routeColors={routeColorMap}
              />
            </div>

            {/* ── Error banner ── */}
            {error && (
              <div className="
                flex items-start gap-3 px-4 py-3 rounded-xl
                bg-red-50 dark:bg-red-900/20
                border border-red-200 dark:border-red-800
                text-sm text-red-700 dark:text-red-400
              ">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* ── Action buttons ── */}
            <div className="flex gap-3">
              <button
                onClick={handleCalculate}
                disabled={loading || validDestCount === 0 || !origin.trim()}
                className="
                  flex-1 flex items-center justify-center gap-2
                  py-3 px-5 rounded-xl font-semibold text-sm
                  bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                  text-white shadow-md shadow-blue-500/20
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                  transition-all duration-150
                "
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    計算中…
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    計算路線 &amp; 距離
                    {validDestCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-xs">
                        {validDestCount}
                      </span>
                    )}
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                disabled={loading}
                title="重設所有資料"
                className="
                  flex items-center justify-center
                  w-11 h-11 rounded-xl shrink-0
                  border border-slate-200 dark:border-slate-700
                  text-slate-500 dark:text-slate-400
                  hover:bg-slate-50 dark:hover:bg-slate-800
                  hover:text-slate-700 dark:hover:text-slate-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-150
                "
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* ── Results table (desktop: in left panel) ── */}
            {hasResults && (
              <div className="
                rounded-2xl border border-slate-200 dark:border-slate-700
                bg-white dark:bg-slate-900 shadow-sm p-5
              ">
                <ResultsTable routes={routes} origin={origin} />
              </div>
            )}

            {/* ── Empty state hint ── */}
            {!hasResults && !loading && (
              <div className="
                rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800
                p-6 text-center text-sm text-slate-400 dark:text-slate-600
              ">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>填寫出發點與目標地點後</p>
                <p>點擊「計算路線」即可查看結果</p>
              </div>
            )}
          </aside>

          {/* ══════════════════════════
               RIGHT PANEL — Map
             ══════════════════════════ */}
          <section
            id="map-section"
            className="
              flex-1 min-h-[400px] lg:min-h-0
              rounded-2xl border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-900 shadow-sm
              overflow-hidden
              lg:sticky lg:top-20 lg:self-start
              lg:h-[calc(100vh-6rem)]
            "
          >
            {/* Map header bar */}
            <div className="
              flex items-center justify-between
              px-4 py-3
              border-b border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-900
            ">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <MapPin className="w-4 h-4 text-blue-500" />
                路線地圖
              </div>
              {hasResults && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {routes
                    .filter((r) => r.status === 'success')
                    .map((r) => (
                      <div
                        key={r.locationId}
                        className="flex items-center gap-1 text-xs"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: r.color }}
                        />
                        <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                          #{r.index}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Map itself */}
            <div className="h-[400px] lg:h-[calc(100%-49px)]">
              <MapView
                routes={routes}
                originCoords={originCoords}
                origin={origin}
              />
            </div>
          </section>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="
        max-w-screen-2xl mx-auto w-full
        px-4 sm:px-6 lg:px-8 py-4
        text-center text-xs text-slate-400 dark:text-slate-600
        border-t border-slate-200 dark:border-slate-800
      ">
        RouteCalc — 後端代理保護 Google Maps API 金鑰 · 地圖由{' '}
        <a
          href="https://www.openstreetmap.org"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-500 underline"
        >
          OpenStreetMap
        </a>{' '}
        提供 · 路線資料由 Google Maps Directions API 提供
      </footer>

      {/* ── Warning / Exhausted modal ── */}
      {modal.open && (
        <WarningModal
          type={modal.type}
          used={modal.quota.used}
          limit={modal.quota.limit}
          remaining={modal.quota.remaining}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  );
}
