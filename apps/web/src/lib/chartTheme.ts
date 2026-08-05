import { useEffect, useState } from 'react';

/*
 * ECharts styling driven by the CSS tokens.
 *
 * Charts are canvas, so they inherit nothing from the stylesheet — every colour has to be
 * handed over explicitly, which is why they kept their light axes and grid lines after the
 * rest of the app went dark. Reading the tokens keeps one palette instead of two.
 */

const readToken = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export interface ChartTheme {
  series: string[];
  text: string;
  muted: string;
  grid: string;
  axis: string;
  surface: string;
  border: string;
  /** Named to match the report metrics, so a series always keeps its colour. */
  metric: Record<'total' | 'contacted' | 'ok' | 'maybe' | 'no' | 'noAnswer' | 'attendees', string>;
}

export function readChartTheme(): ChartTheme {
  const series = [1, 2, 3, 4, 5, 6, 7].map((i, idx) =>
    readToken(`--series-${i}`, ['#1b4f8f', '#c98a00', '#12704a', '#7a5ea8', '#b3283a', '#5c7086', '#0d7d8f'][idx]));
  return {
    series,
    text: readToken('--text-primary', '#0f2338'),
    muted: readToken('--text-muted', '#5c7086'),
    grid: readToken('--chart-grid', '#e3eaf2'),
    axis: readToken('--chart-axis', '#5c7086'),
    surface: readToken('--surface', '#ffffff'),
    border: readToken('--border', '#d8e2ec'),
    metric: {
      total: series[0], contacted: series[1], ok: series[2],
      maybe: series[3], no: series[4], noAnswer: series[5], attendees: series[6],
    },
  };
}

/** Re-reads the tokens whenever the appearance changes, so charts follow the theme live. */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(readChartTheme);
  useEffect(() => {
    const update = () => setTheme(readChartTheme());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', update);
    return () => { observer.disconnect(); media.removeEventListener('change', update); };
  }, []);
  return theme;
}

/** Axis/grid/legend/tooltip defaults every chart shares. */
export function chartBase(t: ChartTheme) {
  return {
    textStyle: { color: t.text, fontFamily: 'Vazirmatn, Tahoma, sans-serif' },
    legend: { textStyle: { color: t.muted }, inactiveColor: t.border, icon: 'roundRect' as const },
    tooltip: {
      backgroundColor: t.surface,
      borderColor: t.border,
      textStyle: { color: t.text },
      extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,.18); border-radius: 12px;',
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: t.border } },
      axisTick: { show: false },
      axisLabel: { color: t.muted },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: t.muted },
      splitLine: { lineStyle: { color: t.grid, type: 'dashed' as const } },
    },
  };
}
