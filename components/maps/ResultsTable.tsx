'use client';

import { useCallback } from 'react';
import { CheckCircle2, XCircle, ArrowUpDown, Download } from 'lucide-react';
import type { RouteResult, TravelMode, AvoidOption } from '@/types/maps';
import type { TravelOptionsState } from '@/components/maps/TravelOptions';

// ── Chinese display labels for travel modes ───────────────────
// Record<TravelMode, string> (not Record<string, string>) enforces exhaustiveness:
// adding a new TravelMode to the union without updating this map is a compile error.
const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  driving:    '開車',
  motorcycle: '機車',
  transit:    '大眾運輸',
  walking:    '步行',
  bicycling:  '騎單車',
};

// ── Chinese display labels for avoid options ──────────────────
// Same exhaustiveness guarantee via Record<AvoidOption, string>.
// Using the narrow Record type prevents accidental typos or missing cases when
// a new AvoidOption is added to the union type.
const AVOID_LABELS: Record<AvoidOption, string> = {
  highways: '避開高速公路',
  tolls:    '避開收費路段',
  ferries:  '避開渡輪',
  indoor:   '避開室內路線',
};

// Delay before revoking the object URL, in milliseconds.
// revokeObjectURL must not be called synchronously after click() because the
// browser initiates the download asynchronously; revoking immediately races
// that read and can produce a failed or empty download on Safari / older
// Chromium builds. 100ms gives the browser time to start the download.
const BLOB_URL_REVOKE_DELAY_MS = 100;

/**
 * Converts a value to a safe, RFC 4180-compliant CSV cell and prevents
 * spreadsheet formula injection (CWE-1236 / OWASP A03: Injection).
 *
 * Spreadsheet applications (Excel, LibreOffice Calc, Google Sheets) execute
 * cells that begin with =, +, -, @ as formulas — even inside quoted CSV fields.
 * Leading \t (tab), \r (CR), and \n (LF) can also shift column boundaries before
 * any formula check, allowing attacks like `\t=cmd|'/c calc'!A1` to execute code.
 *
 * Mitigation steps applied:
 *  1. Strip leading control characters (tab, CR, LF) that could shift boundaries.
 *  2. Prepend an apostrophe to values starting with a formula-trigger character
 *     (=, +, -, @) so the cell is treated as plain text. The apostrophe appears only
 *     in the formula bar, not in the rendered cell display.
 *  3. Escape internal double-quotes by doubling them (RFC 4180 quoting rule).
 *  4. Wrap the entire value in double-quotes.
 *
 * Example:
 *  sanitizeCsvCell('=1+1')  → "\'=1+1"  (apostrophe prevents formula execution)
 *  sanitizeCsvCell('test"quote')  → "test""quote"  (internal quotes doubled)
 */
function sanitizeCsvCell(value: string | number): string {
  // Step 1: Remove leading control characters (CWE-1236 fix)
  let safe = String(value).replace(/^[\t\r\n]+/, '');

  // Step 2: Prepend apostrophe if value starts with formula trigger character
  // This tells Excel/Sheets to treat the cell as text, not formula
  if (/^[=+\-@]/.test(safe)) safe = "'" + safe;

  // Steps 3-4: Escape internal quotes per RFC 4180 and wrap in double-quotes
  return `"${safe.replace(/"/g, '""')}"`;
}

interface Props {
  routes:        RouteResult[];
  origin:        string;
  travelOptions: TravelOptionsState;
}

export default function ResultsTable({ routes, origin, travelOptions }: Props) {
  if (routes.length === 0) return null;

  // Separate routes into success and error groups for badge counts
  const successful = routes.filter((r) => r.status === 'success');
  const failed = routes.filter((r) => r.status === 'error');

  /* ── CSV export ── */
  // Wrapped in useCallback to prevent unnecessary re-renders of the button and
  // to ensure the closure captures the current routes/origin/travelOptions values
  const exportCSV = useCallback(() => {
    // ── Line 1: metadata row ──────────────────────────────────
    // origin is direct user input — must sanitise against formula injection (CWE-1236)
    const originLine = `出發基準點,${sanitizeCsvCell(origin)}`;

    // ── Travel option labels ──────────────────────────────────
    // travelMode is constrained to TravelMode union, so the lookup is always
    // defined (Record<TravelMode, string> enforces exhaustiveness at compile time).
    // No runtime null checks needed — TypeScript guarantees the key exists.
    const travelModeLabel = TRAVEL_MODE_LABELS[travelOptions.travelMode];

    // Join avoid options with the Chinese enumeration mark「、」which contains
    // no comma, so it cannot break the CSV delimiter. Each option label comes from
    // AVOID_LABELS constant (low injection risk) but sanitized for consistency.
    const avoidLabel = travelOptions.avoidOptions
      .map((a) => AVOID_LABELS[a])
      .join('、');

    // ── Line 2: column header row ─────────────────────────────
    // Run through sanitizeCsvCell so a future label containing a comma or
    // formula-trigger character cannot silently corrupt the file structure
    const headerFields = ['#', '目標地點', '距離 (km)', '時間', '交通選項', '路徑選項', '狀態'];
    const headerRow    = headerFields.map(sanitizeCsvCell).join(',');

    // ── Data rows ─────────────────────────────────────────────
    // Travel mode and avoid options are global settings shared by every row.
    // All user-controlled or third-party-API-sourced values go through
    // sanitizeCsvCell to prevent formula injection (CWE-1236).
    const dataRows = routes.map((r) => {
      // Use raw distanceValue (metres) for a reliable numeric format instead
      // of stripping the ' km' suffix from the display string (which is fragile
      // and would lose precision). Divide by 1000 and format to 1 decimal place.
      const distKm    = r.status === 'success' ? (r.distanceValue / 1000).toFixed(1) : 'N/A';

      // duration comes from Google's API — sanitise defensively in case the API
      // ever returns unexpected characters
      const duration  = r.status === 'success' ? r.duration : 'N/A';

      // errorMessage originates from Google's API status field — sanitise to prevent
      // injection even though we've validated the status code at the API boundary
      const status    = r.status === 'success' ? '成功' : `失敗: ${r.errorMessage ?? ''}`;

      // Assemble row fields in the same order as headerFields
      return [
        r.index,       // integer literal — safe, but sanitizeCsvCell handles numbers too
        r.address,     // user-entered destination — sanitised below
        distKm,        // numeric string — sanitised below
        duration,      // API text — sanitised below
        travelModeLabel, // from our own constant — low risk, sanitised for consistency
        avoidLabel,    // from our own constants — sanitised for consistency
        status,        // partly from API errorMessage — sanitised below
      ].map(sanitizeCsvCell).join(',');
    });

    // ── Assemble CSV ──────────────────────────────────────────
    const csv = [originLine, headerRow, ...dataRows].join('\n');

    // ── Trigger download ──────────────────────────────────────
    // Prepend UTF-8 BOM (\uFEFF) so Excel and other spreadsheet apps open the
    // file with correct encoding instead of treating it as ASCII/ANSI
    const blob   = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url    = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href     = url;
    anchor.download = `routes-${new Date().toISOString().slice(0, 10)}.csv`;

    // Append anchor to DOM before .click() — this ensures reliable behaviour
    // across browsers (Safari in particular requires the element to be in the
    // DOM tree for programmatic clicks to trigger downloads reliably).
    // Immediately remove after to keep the DOM clean and avoid memory leaks.
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // Defer revocation using setTimeout — the browser reads the blob asynchronously
    // after .click(), so revoking immediately would race that read and cause the
    // download to fail or be empty (especially on Safari and older Chromium builds).
    // BLOB_URL_REVOKE_DELAY_MS (100ms) gives the browser time to initiate the download.
    setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_REVOKE_DELAY_MS);
  }, [routes, origin, travelOptions]);

  return (
    <section>
      {/* Header row with title badge and export button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            計算結果
          </span>
          {/* Success count badge */}
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-medium">
            {successful.length} 成功
          </span>
          {/* Failure count badge — only show if there are failures */}
          {failed.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-medium">
              {failed.length} 失敗
            </span>
          )}
        </div>

        {/* Export CSV button — triggers download via useCallback */}
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

      {/* Origin reference point display */}
      <div className="mb-3 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs text-green-800 dark:text-green-400 flex items-center gap-1.5">
        <span className="font-semibold">
          {/* role="img" + aria-label makes the emoji accessible to screen readers
              without relying on the emoji renderer to provide semantic meaning */}
          <span role="img" aria-label="基準點">📍</span> 基準點：
        </span>
        <span className="truncate">{origin}</span>
      </div>

      {/* Results table — responsive layout (desktop table + mobile cards) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Desktop table layout — hidden on mobile (sm breakpoint) */}
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
                  {/* Index column — coloured circle with route number */}
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: route.color }}
                    >
                      {route.index}
                    </div>
                  </td>

                  {/* Destination address and error message (if any) */}
                  <td className="px-4 py-3">
                    <span className="text-slate-800 dark:text-slate-200 break-words leading-snug">
                      {route.address}
                    </span>
                    {/* Show error message below address if route calculation failed */}
                    {route.status === 'error' && route.errorMessage && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                        {route.errorMessage}
                      </p>
                    )}
                  </td>

                  {/* Distance column — formatted distance or dash if error */}
                  <td className="px-4 py-3 text-right">
                    {route.status === 'success' ? (
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {route.distance}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600">—</span>
                    )}
                  </td>

                  {/* Duration column — travel time or dash if error */}
                  <td className="px-4 py-3 text-right">
                    {route.status === 'success' ? (
                      <span className="text-slate-600 dark:text-slate-400">{route.duration}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600">—</span>
                    )}
                  </td>

                  {/* Status column — checkmark for success, X for error */}
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

        {/* Mobile card layout — visible only on mobile (below sm breakpoint) */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {routes.map((route) => (
            <div
              key={route.locationId}
              className="p-4 bg-white dark:bg-slate-900"
            >
              <div className="flex items-start gap-3">
                {/* Coloured index circle — shrink-0 prevents flex from compressing it */}
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: route.color }}
                >
                  {route.index}
                </div>
                <div className="flex-1 min-w-0">
                  {/* Destination address */}
                  <p className="text-sm text-slate-800 dark:text-slate-200 break-words leading-snug">
                    {route.address}
                  </p>
                  {/* Conditional content based on success/error status */}
                  {route.status === 'success' ? (
                    // Success card: show distance, time, and checkmark
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
                    // Error card: show error message and X icon
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
