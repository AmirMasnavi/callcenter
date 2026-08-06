import ReactECharts from '../lib/echarts';
import { chartBase, useChartTheme } from '../lib/chartTheme';
import type { Slice } from '../pages/ComparePage';

/*
 * One metric across several operators, sorted best first.
 *
 * Sorted rather than alphabetical because the question is "who is doing better", and a
 * ranked bar answers it at a glance where an alphabetical one makes you read every label.
 */
export default function CompareChart({ rows, metricKey, label }: {
  rows: Slice[]; metricKey: string; label: string;
}) {
  const ct = useChartTheme(), base = chartBase(ct);
  const sorted = [...rows].sort((a, b) =>
    Number(a[metricKey as keyof Slice] ?? 0) - Number(b[metricKey as keyof Slice] ?? 0));

  const option = {
    ...base,
    tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 12, right: 32, top: 16, bottom: 24, containLabel: true },
    xAxis: { ...base.valueAxis, type: 'value' },
    yAxis: { ...base.categoryAxis, type: 'category', data: sorted.map(s => s.displayName) },
    series: [{
      name: label, type: 'bar',
      data: sorted.map(s => Number(s[metricKey as keyof Slice] ?? 0)),
      itemStyle: { color: ct.metric.contacted, borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', color: ct.text, fontSize: 11 },
    }],
  };

  return <ReactECharts option={option} style={{ height: Math.max(200, sorted.length * 46) }} notMerge />;
}
