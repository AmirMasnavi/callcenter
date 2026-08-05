import ReactECharts from '../lib/echarts';
import { chartBase, useChartTheme } from '../lib/chartTheme';
import type { StaffSummary } from '../pages/TimesheetPage';

/*
 * Worked hours against the period's target, one row per person.
 *
 * Its own module so ECharts (~1MB) is a lazy chunk rather than part of the payroll page's
 * initial load — the totals and the list are what people open this screen for.
 */
export default function HoursChart({ rows }: { rows: StaffSummary[] }) {
  const ct = useChartTheme(), base = chartBase(ct);
  const hours = (m: number) => Math.round(m / 60 * 10) / 10;

  const option = {
    ...base,
    tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { ...base.legend, top: 0 },
    grid: { left: 12, right: 24, top: 48, bottom: 28, containLabel: true },
    // Centred under the axis; at the end it was clipped.
    xAxis: { ...base.valueAxis, type: 'value', name: 'ساعت', nameLocation: 'middle', nameGap: 28 },
    yAxis: { ...base.categoryAxis, type: 'category', data: rows.map(r => r.displayName).reverse() },
    series: [
      { name: 'ساعات کارکرد', type: 'bar',
        data: rows.map(r => hours(r.workedMinutes)).reverse(),
        itemStyle: { color: ct.metric.contacted, borderRadius: [0, 4, 4, 0] } },
      { name: 'سقف بازه', type: 'bar',
        data: rows.map(r => hours(r.targetMinutes)).reverse(),
        itemStyle: { color: ct.metric.noAnswer, opacity: 0.35, borderRadius: [0, 4, 4, 0] } },
    ],
  };

  return <ReactECharts option={option} style={{ height: Math.max(220, rows.length * 52) }} notMerge />;
}
