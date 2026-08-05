import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, apiUrl, fa, faDate } from '../lib/api';
import Loading from '../components/Loading';
import Icon from '../components/Icon';
import JalaliDate, { todayIso } from '../components/JalaliDate';
import { DateObject } from 'react-multi-date-picker';
import gregorian from 'react-date-object/calendars/gregorian';
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

/*
 * Ranges are anchored to Tehran's date, not the browser's UTC one. After 20:30 UTC it is
 * already tomorrow in Tehran, so toISOString() would end the range yesterday — quietly
 * dropping the current day's shifts and leaving no preset looking selected.
 */
const daysAgoIso = (n: number) => {
  const d = new DateObject({ date: todayIso(), format: 'YYYY-MM-DD', calendar: gregorian });
  d.subtract(n, 'days');
  return d.format('YYYY-MM-DD');
};

/* Payroll works in fixed windows, so the common ones are one tap rather than two date
   pickers. "۳۰ روز" is the pay period; "۱۰ روز" is the mid-period check. */
const PRESETS: { label: string; days: number }[] = [
  { label: '۱۰ روز', days: 9 },
  { label: '۱۵ روز', days: 14 },
  { label: '۳۰ روز', days: 29 },
];
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
  const [printing, setPrinting] = useState(false);
  const stopPrinting = useCallback(() => setPrinting(false), []);
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
    grid: { left: 12, right: 24, top: 48, bottom: 28, containLabel: true },
    // The axis name sat at the far end and got clipped; centred under the axis it reads.
    xAxis: {
      ...base.valueAxis, type: 'value',
      name: 'ساعت', nameLocation: 'middle', nameGap: 28,
    },
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
          <button className="icon-button" title="فرم امضای پرسنل برای پرونده حقوق — یک برگ برای هر نفر"
                  onClick={() => setPrinting(true)}>
            <Icon name="sheet" label="چاپ فرم امضا" />
            <span className="btn-label">چاپ فرم امضا</span>
          </button>
          <button className="icon-button" title="همان جدول‌ها در قالب Excel، برای محاسبه"
                  onClick={() => window.open(apiUrl(`/api/v1/attendance/report.xlsx?from=${from}&to=${to}`))}>
            <Icon name="download" label="خروجی Excel" />
            <span className="btn-label">Excel</span>
          </button>
        </div>
      </header>

      <section className="toolbar timesheet-range">
        <div className="segmented range-presets">
          {PRESETS.map(p => {
            const active = from === daysAgoIso(p.days) && to === todayIso();
            return (
              <button key={p.days} className={active ? 'active' : ''}
                      onClick={() => { setFrom(daysAgoIso(p.days)); setTo(todayIso()); }}>
                {p.label}
              </button>
            );
          })}
        </div>
        <label>از<JalaliDate value={from} onChange={setFrom} max={false} /></label>
        <label>تا<JalaliDate value={to} onChange={setTo} /></label>
        <div className="range-total">
          <span>جمع کل</span><b>{asHours(totalMinutes)}</b>
        </div>
      </section>

      {printing && <PrintableTimesheet from={from} to={to} onDone={stopPrinting} />}

      {q.isLoading ? <Loading /> : (
        <>
          {/* Its own card, full width. The dashboard's .charts grid puts two panels side by
              side, which squeezed this one into a third of the page. */}
          <section className="chart-card">
            <div className="section-title"><b>کارکرد در برابر سقف</b><span>{faDate(from)} تا {faDate(to)}</span></div>
            {rows.length
              ? <ReactECharts option={chart} style={{ height: Math.max(220, rows.length * 52) }} notMerge />
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

/**
 * The printable timesheet — the paper form, filled in.
 *
 * A plain window.print() of the dashboard prints charts and chrome, which is no use to
 * anyone. This renders one signed sheet per person: every day in the period, their shifts,
 * the daily total, the period total against their target, and a signature column, so it
 * can go straight into a payroll file.
 */
function PrintableTimesheet({ from, to, onDone }: { from: string; to: string; onDone: () => void }) {
  const details = useQuery({
    queryKey: ['print-timesheet', from, to],
    queryFn: () => api<StaffDetail[]>(`/api/v1/attendance/report/details?from=${from}&to=${to}`),
  });

  const ready = details.isSuccess;
  // Print once the sheets are actually painted — firing earlier gives blank pages. Two frames
  // is the reliable signal that layout has run; a timeout is a guess about how slow the device is.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cancelled) return;
      window.print();
      onDone();
    }));
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [ready, onDone]);

  if (details.isError) return <div className="print-loading">آماده‌سازی فرم ناموفق بود.</div>;
  if (!ready) return <div className="print-loading">در حال آماده‌سازی فرم…</div>;

  return (
    <div className="printable">
      {details.data.map(d => (
        <section key={d.summary.userId} className="print-sheet">
          <header>
            <h2>فرم حضور و غیاب — علم و صنعت آریا</h2>
            {/* Says on the page what the page is for, so nobody has to ask. */}
            <p className="print-purpose">
              مبنای محاسبه حقوق این بازه. پس از امضای پرسنل و مسئول دفتر، در پرونده بایگانی می‌شود.
            </p>
            <div className="print-meta">
              <span><b>پرسنل:</b> {d.summary.displayName}</span>
              <span><b>بازه:</b> {faDate(from)} تا {faDate(to)}</span>
              <span><b>روزهای حضور:</b> {fa(d.summary.daysPresent)}</span>
            </div>
          </header>

          <table>
            <thead>
              <tr><th>تاریخ</th><th>ساعت ورود</th><th>ساعت خروج</th><th>مدت</th><th>توضیحات</th><th>امضا</th></tr>
            </thead>
            <tbody>
              {d.days.length ? d.days.flatMap(day => day.shifts.map((s, i) => (
                <tr key={s.id}>
                  <td>{i === 0 ? faDate(day.date) : ''}</td>
                  <td>{timeOf(s.entryAt)}</td>
                  <td>{s.exitAt ? timeOf(s.exitAt) : '—'}</td>
                  <td>{asHours(s.workedMinutes)}</td>
                  <td>{s.note || ''}</td>
                  <td className="sign-cell" />
                </tr>
              ))) : <tr><td colSpan={6}>در این بازه حضوری ثبت نشده است.</td></tr>}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}><b>جمع کل</b></td>
                <td><b>{asHours(d.summary.workedMinutes)}</b></td>
                <td colSpan={2}>
                  از {fa(d.summary.targetHours)} ساعت ({fa(Math.round(d.summary.targetPercent))}٪)
                </td>
              </tr>
            </tfoot>
          </table>

          <footer className="print-signoff">
            <span>امضای پرسنل: ....................</span>
            <span>امضای مسئول دفتر: ....................</span>
            <span>تاریخ: ....................</span>
          </footer>
        </section>
      ))}
    </div>
  );
}
