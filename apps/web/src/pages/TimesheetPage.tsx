import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, apiUrl, fa, faDate } from '../lib/api';
import Loading from '../components/Loading';
import Icon from '../components/Icon';
import JalaliDate from '../components/JalaliDate';
import { asHours } from './AttendancePage';
import { chartBase, useChartTheme } from '../lib/chartTheme';
import ReactECharts from 'echarts-for-react';

interface StaffSummary {
  userId: number; displayName: string; username: string;
  workedMinutes: number; daysPresent: number; shifts: number;
  targetHours: number; targetPercent: number;
  reports: number; contacted: number; ok: number; attendees: number; successRate: number;
}
interface DayRow { date: string; workedMinutes: number; shifts: { id: number; entryAt: string; exitAt: string | null; workedMinutes: number; note: string | null }[] }
interface StaffDetail { summary: StaffSummary; days: DayRow[] }

const daysAgoIso = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const todayIso = () => new Date().toISOString().slice(0, 10);
const timeOf = (iso: string) => new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }).format(new Date(iso));

/*
 * Payroll view: worked hours and call performance for the same period, side by side.
 *
 * The hours come from real clock times, so a 30-day range means "the hours actually worked
 * across those 30 days" — not days multiplied by a nominal shift length, which is the
 * distinction the paper process could never enforce.
 */
export default function TimesheetPage() {
  const [from, setFrom] = useState(daysAgoIso(29));
  const [to, setTo] = useState(todayIso());
  const [openUser, setOpenUser] = useState<number>();
  const ct = useChartTheme(), base = chartBase(ct);

  const q = useQuery({
    queryKey: ['timesheet', from, to],
    queryFn: () => api<StaffSummary[]>(`/api/v1/attendance/report?from=${from}&to=${to}`),
  });

  const rows = q.data ?? [];
  const totalMinutes = rows.reduce((sum, r) => sum + r.workedMinutes, 0);

  const chart = {
    ...base,
    tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { ...base.legend, top: 0 },
    grid: { left: 12, right: 20, top: 44, bottom: 12, containLabel: true },
    xAxis: { ...base.valueAxis, type: 'value', name: 'ساعت' },
    yAxis: { ...base.categoryAxis, type: 'category', data: rows.map(r => r.displayName).reverse() },
    series: [
      { name: 'ساعات کارکرد', type: 'bar',
        data: rows.map(r => Math.round(r.workedMinutes / 60 * 10) / 10).reverse(),
        itemStyle: { color: ct.metric.contacted, borderRadius: [0, 4, 4, 0] } },
      { name: 'سقف ماهانه', type: 'bar',
        data: rows.map(r => r.targetHours).reverse(),
        itemStyle: { color: ct.metric.noAnswer, opacity: 0.35, borderRadius: [0, 4, 4, 0] } },
    ],
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">حقوق و دستمزد</span>
          <h1>ساعات کاری پرسنل</h1>
          <p>ساعات واقعی کارکرد و عملکرد تماس‌ها در یک بازه.</p>
        </div>
        <div className="head-actions">
          <button className="icon-button" title="چاپ" onClick={() => window.print()}>
            <Icon name="sheet" label="چاپ" />
          </button>
          <button className="icon-button" title="خروجی Excel"
                  onClick={() => window.open(apiUrl(`/api/v1/attendance/report.xlsx?from=${from}&to=${to}`))}>
            <Icon name="download" label="خروجی Excel" />
          </button>
        </div>
      </header>

      <section className="toolbar timesheet-range">
        <label>از<JalaliDate value={from} onChange={setFrom} max={false} /></label>
        <label>تا<JalaliDate value={to} onChange={setTo} /></label>
        <div className="range-total">
          <span>جمع کل</span><b>{asHours(totalMinutes)}</b>
        </div>
      </section>

      {q.isLoading ? <Loading /> : (
        <>
          <section className="charts">
            <div className="section-title"><b>کارکرد در برابر سقف</b><span>{faDate(from)} تا {faDate(to)}</span></div>
            {rows.length
              ? <ReactECharts option={chart} style={{ height: Math.max(220, rows.length * 46) }} notMerge />
              : <div className="empty compact">در این بازه ساعتی ثبت نشده است.</div>}
          </section>

          <section className="staff-list timesheet-list">
            {rows.map(r => (
              <article key={r.userId}>
                <button className="timesheet-row" onClick={() => setOpenUser(openUser === r.userId ? undefined : r.userId)}>
                  <div className="staff-text">
                    <b>{r.displayName}</b>
                    <span>{fa(r.daysPresent)} روز حضور · {fa(r.shifts)} شیفت</span>
                  </div>
                  <div className="hours-cell">
                    <b>{asHours(r.workedMinutes)}</b>
                    <span>از {fa(r.targetHours)} ساعت</span>
                  </div>
                  {/* Progress against the person's own target, not a shared one. */}
                  <div className="target-bar" title={`${fa(Math.round(r.targetPercent))}٪`}>
                    <i style={{ width: `${Math.min(100, r.targetPercent)}%` }}
                       className={r.targetPercent >= 100 ? 'full' : r.targetPercent >= 70 ? 'mid' : 'low'} />
                  </div>
                  <i className="chev" aria-hidden="true">{openUser === r.userId ? '⌃' : '⌄'}</i>
                </button>

                {openUser === r.userId && <StaffDetailView userId={r.userId} from={from} to={to} summary={r} />}
              </article>
            ))}
            {!rows.length && <div className="empty compact">پرسنلی در این بازه یافت نشد.</div>}
          </section>
        </>
      )}
    </div>
  );
}

function StaffDetailView({ userId, from, to, summary }: { userId: number; from: string; to: string; summary: StaffSummary }) {
  const q = useQuery({
    queryKey: ['timesheet-detail', userId, from, to],
    queryFn: () => api<StaffDetail>(`/api/v1/attendance/report/${userId}?from=${from}&to=${to}`),
  });

  return (
    <div className="timesheet-detail">
      {/* Hours alone do not say whether the time was productive — the call figures for the
          same window sit right beside them. */}
      <div className="detail-stats">
        <div><span>گزارش</span><b>{fa(summary.reports)}</b></div>
        <div><span>تماس</span><b>{fa(summary.contacted)}</b></div>
        <div><span>پاسخ مثبت</span><b>{fa(summary.ok)}</b></div>
        <div><span>حاضرین</span><b>{fa(summary.attendees)}</b></div>
        <div><span>نرخ موفقیت</span><b>{fa(Math.round(summary.successRate * 10) / 10)}٪</b></div>
      </div>

      {q.isLoading ? <Loading /> : (
        <div className="table-scroll">
          <table>
            <thead><tr><th>تاریخ</th><th>ورود</th><th>خروج</th><th>مدت</th><th>توضیحات</th></tr></thead>
            <tbody>
              {q.data?.days.length ? q.data.days.flatMap(day =>
                day.shifts.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i === 0 ? faDate(day.date) : ''}</td>
                    <td>{timeOf(s.entryAt)}</td>
                    <td>{s.exitAt ? timeOf(s.exitAt) : '—'}</td>
                    <td>{asHours(s.workedMinutes)}</td>
                    <td>{s.note || '—'}</td>
                  </tr>
                ))
              ) : <tr><td colSpan={5} className="empty-cell">در این بازه حضوری ثبت نشده است.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
