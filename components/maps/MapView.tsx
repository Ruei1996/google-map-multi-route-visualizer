/**
 * MapView — Server-safe wrapper that dynamically loads the Leaflet component
 * client-side only (ssr: false), preventing "window is not defined" errors.
 */
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import type { RouteResult } from '@/types/maps';

const MapViewLeaflet = dynamic(() => import('./MapViewLeaflet'), {
  ssr: false,
  loading: () => (
    <div className="
      w-full h-full min-h-[400px] rounded-xl
      flex flex-col items-center justify-center gap-3
      bg-slate-100 dark:bg-slate-800
      border border-slate-200 dark:border-slate-700
    ">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      <p className="text-sm text-slate-500 dark:text-slate-400">地圖載入中…</p>
    </div>
  ),
});

interface Props {
  routes: RouteResult[];
  originCoords?: { lat: number; lng: number };
  origin: string;
}

export default function MapView(props: Props) {
  return <MapViewLeaflet {...props} />;
}
