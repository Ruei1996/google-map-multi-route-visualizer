'use client';

/**
 * MapViewLeaflet — Loads Leaflet from CDN (no npm package needed).
 *
 * Rendering strategy:
 *  • Leaflet CSS injected once via <link> tag
 *  • Leaflet JS loaded dynamically from CDN; avoids SSR issues entirely
 *  • This component is always loaded with next/dynamic + ssr:false
 */

import { useEffect, useRef } from 'react';
import type { RouteResult } from '@/types/maps';
import { decodePolyline } from '@/lib/maps/polyline';

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { L?: any }
}

function injectLeafletCSS() {
  if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS;
  document.head.appendChild(link);
}

function loadLeafletJS(): Promise<any> {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${LEAFLET_JS}"]`)) {
      const poll = setInterval(() => {
        if (window.L) { clearInterval(poll); resolve(window.L); }
      }, 50);
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => resolve(window.L!);
    script.onerror = () => reject(new Error('Leaflet CDN failed to load'));
    document.head.appendChild(script);
  });
}

interface Props {
  routes: RouteResult[];
  originCoords?: { lat: number; lng: number };
  origin: string;
}

export default function MapViewLeaflet({ routes, originCoords, origin }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);

  /* ── Initialise the Leaflet map instance once ── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    const init = async () => {
      injectLeafletCSS();
      const L = await loadLeafletJS();
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      map.setView([25.033, 121.565], 10); // Default: Taiwan
      mapRef.current = map;
    };

    init().catch(console.error);
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Redraw routes whenever data changes ── */
  useEffect(() => {
    const redraw = async () => {
      const map = mapRef.current;
      const L = window.L;
      if (!map || !L) return;

      // Remove all previous layers
      layersRef.current.forEach((l) => { try { map.removeLayer(l); } catch { /**/ } });
      layersRef.current = [];

      const bounds: [number, number][] = [];

      /* Origin marker — green teardrop */
      if (originCoords) {
        const icon = L.divIcon({
          html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;
            background:#22c55e;border:3px solid #fff;transform:rotate(-45deg);
            box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -36],
        });
        const m = L.marker([originCoords.lat, originCoords.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<b style="color:#166534">📍 出發基準點</b><br>
             <span style="font-size:12px;color:#374151">${origin}</span>`,
          );
        layersRef.current.push(m);
        bounds.push([originCoords.lat, originCoords.lng]);
      }

      /* Route polylines + numbered destination markers */
      for (const route of routes) {
        if (route.status !== 'success' || !route.encodedPolyline) continue;

        const pts = decodePolyline(route.encodedPolyline);
        if (!pts.length) continue;

        /* Shadow */
        layersRef.current.push(
          L.polyline(pts, { color: '#000', weight: 7, opacity: 0.1, lineJoin: 'round', lineCap: 'round' }).addTo(map),
        );

        /* Colour line */
        const line = L.polyline(pts, {
          color: route.color, weight: 4, opacity: 0.85, lineJoin: 'round', lineCap: 'round',
        }).addTo(map).bindPopup(
          `<b style="color:${route.color}">#${route.index} ${route.address}</b><br>
           <span style="font-size:12px;color:#374151">🛣️ <b>${route.distance}</b> &nbsp;⏱️ <b>${route.duration}</b></span>`,
        );
        layersRef.current.push(line);
        pts.forEach((p) => bounds.push(p));

        /* Destination marker */
        if (route.endLocation) {
          const dIcon = L.divIcon({
            html: `<div style="display:flex;align-items:center;justify-content:center;
              width:28px;height:28px;border-radius:50%;background:${route.color};
              border:3px solid #fff;color:#fff;font-weight:700;font-size:11px;
              box-shadow:0 2px 8px rgba(0,0,0,.35)">${route.index}</div>`,
            className: '',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -16],
          });
          const dm = L.marker([route.endLocation.lat, route.endLocation.lng], { icon: dIcon })
            .addTo(map)
            .bindPopup(
              `<b style="color:${route.color}">#${route.index} ${route.address}</b><br>
               <span style="font-size:12px;color:#374151">🛣️ <b>${route.distance}</b> &nbsp;⏱️ <b>${route.duration}</b></span>`,
            );
          layersRef.current.push(dm);
        }
      }

      /* Fit map to all points */
      if (bounds.length) {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14, animate: true, duration: 0.6 });
      }
    };

    const tid = setTimeout(() => redraw().catch(console.error), 120);
    return () => clearTimeout(tid);
  }, [routes, originCoords, origin]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] rounded-xl overflow-hidden"
      aria-label="路線地圖"
    />
  );
}
