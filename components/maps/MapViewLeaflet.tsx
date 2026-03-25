'use client';

/**
 * MapViewLeaflet — Loads Leaflet from CDN (no npm package needed).
 *
 * Rendering strategy:
 *  • Leaflet CSS injected once via <link> tag
 *  • Leaflet JS loaded dynamically from CDN; avoids SSR issues entirely
 *  • This component is always loaded with next/dynamic + ssr:false
 *
 * Route info labels:
 *  • Each successful route displays a distance + time badge at the
 *    midpoint of its polyline, so users can read the info at a glance
 *    without having to click on the line.
 *
 * Travel mode icon:
 *  • The origin marker popup and route labels show the active travel mode.
 */

import { useEffect, useRef } from 'react';
import type { RouteResult } from '@/types/maps';
import { decodePolyline } from '@/lib/maps/polyline';

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS  = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { L?: any }
}

// ── CDN helpers ───────────────────────────────────────────────

/** Injects the Leaflet stylesheet once into <head> */
function injectLeafletCSS() {
  if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = LEAFLET_CSS;
  document.head.appendChild(link);
}

/** Loads Leaflet JS from CDN; resolves with the global `L` object */
function loadLeafletJS(): Promise<any> {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    // If the <script> tag already exists, poll until `window.L` is ready
    if (document.querySelector(`script[src="${LEAFLET_JS}"]`)) {
      const poll = setInterval(() => {
        if (window.L) { clearInterval(poll); resolve(window.L); }
      }, 50);
      return;
    }
    const script    = document.createElement('script');
    script.src      = LEAFLET_JS;
    script.onload   = () => resolve(window.L!);
    script.onerror  = () => reject(new Error('Leaflet CDN failed to load'));
    document.head.appendChild(script);
  });
}

// ── Travel mode display helpers ───────────────────────────────

/** Returns an emoji representing the given travel mode for UI labels */
function travelModeEmoji(mode: RouteResult['travelMode']): string {
  switch (mode) {
    case 'walking':    return '🚶';
    case 'bicycling':  return '🚲';
    case 'transit':    return '🚌';
    case 'motorcycle': return '🏍️';
    case 'driving':
    default:           return '🚗';
  }
}

// ── Component Props ───────────────────────────────────────────

interface Props {
  routes:        RouteResult[];
  originCoords?: { lat: number; lng: number };
  origin:        string;
}

// ── Component ─────────────────────────────────────────────────

export default function MapViewLeaflet({ routes, originCoords, origin }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const layersRef    = useRef<any[]>([]);

  /* ── Initialise the Leaflet map instance (runs once on mount) ── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    const init = async () => {
      injectLeafletCSS();
      const L = await loadLeafletJS();
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl:       true,
        scrollWheelZoom:   true,
        attributionControl: true,
      });

      // Base tile layer — OpenStreetMap (free, no API key required)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      map.setView([25.033, 121.565], 10); // Default view: Taiwan
      mapRef.current = map;
    };

    init().catch(console.error);

    // Cleanup: remove map instance when component unmounts
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // intentional: map init must only run once on mount

  /* ── Redraw routes whenever route data or origin changes ── */
  useEffect(() => {
    const redraw = async () => {
      const map = mapRef.current;
      const L   = window.L;
      if (!map || !L) return;

      // ── 1. Clear all existing layers ──────────────────────
      layersRef.current.forEach((l) => { try { map.removeLayer(l); } catch { /**/ } });
      layersRef.current = [];

      // Accumulate all rendered points to auto-fit the viewport
      const bounds: [number, number][] = [];

      // ── 2. Origin marker — green teardrop pin ──────────────
      if (originCoords) {
        const icon = L.divIcon({
          html: `<div style="
            width:32px;height:32px;border-radius:50% 50% 50% 0;
            background:#22c55e;border:3px solid #fff;transform:rotate(-45deg);
            box-shadow:0 2px 8px rgba(0,0,0,.35)
          "></div>`,
          className: '',
          iconSize:    [32, 32],
          iconAnchor:  [16, 32],
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

      // ── 3. Route polylines + markers + info labels ─────────
      for (const route of routes) {
        if (route.status !== 'success' || !route.encodedPolyline) continue;

        const pts = decodePolyline(route.encodedPolyline);
        if (!pts.length) continue;

        // 3a. Shadow layer — subtle dark outline for contrast
        layersRef.current.push(
          L.polyline(pts, {
            color:    '#000',
            weight:   7,
            opacity:  0.10,
            lineJoin: 'round',
            lineCap:  'round',
          }).addTo(map),
        );

        // 3b. Coloured route line with click popup
        const modeEmoji  = travelModeEmoji(route.travelMode);
        const popupHtml  = `
          <b style="color:${route.color}">#${route.index} ${route.address}</b><br>
          <span style="font-size:12px;color:#374151">
            🛣️ <b>${route.distance}</b>
            &nbsp;⏱️ <b>${route.duration}</b>
            ${route.durationInTraffic ? `&nbsp;🚦 <b>${route.durationInTraffic}</b>` : ''}
            &nbsp;${modeEmoji}
          </span>`;

        const line = L.polyline(pts, {
          color:    route.color,
          weight:   4,
          opacity:  0.85,
          lineJoin: 'round',
          lineCap:  'round',
        }).addTo(map).bindPopup(popupHtml);
        layersRef.current.push(line);
        pts.forEach((p) => bounds.push(p));

        // ── 3c. Midpoint info label ────────────────────────────
        // Place a non-interactive badge at the ~50% point of the polyline
        // so users can see distance & time without clicking.
        if (pts.length > 0) {
          const midPt = pts[Math.floor(pts.length / 2)];

          // Convert hex color to a slightly darker shade for text readability
          const labelIcon = L.divIcon({
            html: `
              <div style="
                display:inline-flex;
                align-items:center;
                gap:4px;
                padding:3px 7px;
                background:${route.color};
                color:#fff;
                font-size:11px;
                font-weight:600;
                border-radius:99px;
                border:2px solid #fff;
                box-shadow:0 1px 6px rgba(0,0,0,.30);
                white-space:nowrap;
                pointer-events:none;
                line-height:1.3;
              ">
                <span>#${route.index}</span>
                <span style="opacity:.75">|</span>
                <span>🛣️ ${route.distance}</span>
                <span style="opacity:.75">·</span>
                <span>⏱️ ${route.duration}</span>
                ${route.durationInTraffic
                  ? `<span style="opacity:.75">·</span><span>🚦 ${route.durationInTraffic}</span>`
                  : ''}
              </div>`,
            className:  '',
            // Anchor at the horizontal centre / top of the div
            iconAnchor: [60, 12],
          });

          const labelMarker = L.marker(midPt, {
            icon:        labelIcon,
            interactive: false, // not clickable — purely decorative
            zIndexOffset: 100,  // float above polylines
          }).addTo(map);
          layersRef.current.push(labelMarker);
        }

        // ── 3d. Numbered destination marker ───────────────────
        if (route.endLocation) {
          const dIcon = L.divIcon({
            html: `<div style="
              display:flex;align-items:center;justify-content:center;
              width:28px;height:28px;border-radius:50%;
              background:${route.color};
              border:3px solid #fff;color:#fff;font-weight:700;font-size:11px;
              box-shadow:0 2px 8px rgba(0,0,0,.35)
            ">${route.index}</div>`,
            className:   '',
            iconSize:    [28, 28],
            iconAnchor:  [14, 14],
            popupAnchor: [0, -16],
          });
          const dm = L.marker(
            [route.endLocation.lat, route.endLocation.lng],
            { icon: dIcon },
          )
            .addTo(map)
            .bindPopup(popupHtml);
          layersRef.current.push(dm);
        }
      }

      // ── 4. Auto-fit map to all rendered points ─────────────
      if (bounds.length) {
        map.fitBounds(bounds, {
          padding:  [48, 48],
          maxZoom:  14,
          animate:  true,
          duration: 0.6,
        });
      }
    };

    // Small delay lets React finish painting before Leaflet redraws
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
