/*
 * A minimal ECharts build.
 *
 * `echarts-for-react` pulls in the whole library by default — every chart type, map, GL
 * renderer and locale — which came to 1.1 MB minified for the three chart types this app
 * draws. Registering only what is used cuts that sharply, and anything not registered fails
 * loudly in development rather than silently rendering blank.
 *
 * Adding a chart type means adding its series, and any component it needs, to `echarts.use`.
 */
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import EChartsReactCore from 'echarts-for-react/lib/core';
import type { EChartsReactProps } from 'echarts-for-react';

echarts.use([
  BarChart, LineChart, PieChart,
  GridComponent, LegendComponent, TitleComponent, TooltipComponent,
  CanvasRenderer,
]);

/** Drop-in replacement for the default `echarts-for-react` export. */
export default function ReactECharts(props: Omit<EChartsReactProps, 'echarts'>) {
  return <EChartsReactCore {...props} echarts={echarts} />;
}
