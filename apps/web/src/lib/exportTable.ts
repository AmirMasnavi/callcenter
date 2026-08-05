/*
 * Client-side CSV export for tables that are already loaded.
 *
 * The server keeps its own xlsx/csv endpoints for the dashboard aggregates; this covers
 * the plain tables (users, schools, audit, per-school rows) where round-tripping to the
 * API would add an endpoint for data the browser is already holding.
 */

/** Excel decides encoding from the BOM; without it Persian headers arrive as mojibake. */
const BOM = '﻿';

const cell = (value: unknown) => {
  const s = value === null || value === undefined ? '' : String(value);
  // Quote whenever the value could otherwise break the row, and double any inner quotes.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return BOM;
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(cell).join(',')];
  for (const row of rows) lines.push(headers.map(h => cell(row[h])).join(','));
  return BOM + lines.join('\r\n');
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads a rendered <table> straight out of the DOM, so it always matches what is on screen. */
export function tableToRows(table: HTMLTableElement): Record<string, string>[] {
  const headers = [...table.querySelectorAll('thead th')].map(th => th.textContent?.trim() || '');
  return [...table.querySelectorAll('tbody tr')]
    .filter(tr => !tr.querySelector('.empty-cell'))
    .map(tr => {
      const cells = [...tr.querySelectorAll('td')];
      return Object.fromEntries(headers.map((h, i) => [h, cells[i]?.textContent?.trim() || '']));
    });
}
