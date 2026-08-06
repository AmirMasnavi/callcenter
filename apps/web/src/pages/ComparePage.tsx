import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, fa, faDate } from '../lib/api';
import lazyPage from '../lib/lazyPage';
import Loading from '../components/Loading';
import { asHours, signedHours } from './AttendancePage';
import type { PeriodStatus } from './TimesheetPage';

const CompareChart = lazyPage(() => import('../components/CompareChart'));

export interface Slice {
  userId: number; displayName: string; days: number; shifts: number;
  workedMinutes: number; targetMinutes: number; balanceMinutes: number;
  reports: number; contacted: number; ok: number; attendees: number;
  successRate: number; okPerDay: number; hoursPerDay: number;
  firstDay: string | null; lastDay: string | null;
}

/*
 * Windows are counted in each person's OWN attendance days.
 *
 * "۱۰ روز" means their first ten days of work, not the last ten on a calendar. Someone
 * twenty-five days into a cycle and someone on day eight are then measured over the same
 * stretch — the only way putting them next to each other says anything.
 */
const WINDOWS = [
  { days: 10, label: '۱۰ روز اول' },
  { days: 15, label: '۱۵ روز اول' },
  { days: 30, label: '۳۰ روز اول' },
  { days: 0, label: 'کل دوره' },
];

type Metric = { key: keyof Slice; label: string; unit?: string; fmt?: (s: Slice) => string };
const METRICS: Metric[] = [
  { key: 'ok', label: 'پاسخ مثبت' },
  { key: 'contacted', label: 'تماس گرفته‌شده' },
  { key: 'attendees', label: 'حاضرین در کلاس' },
  { key: 'okPerDay', label: 'پاسخ مثبت در روز' },
  { key: 'successRate', label: 'نرخ موفقیت', unit: '٪' },
  { key: 'hoursPerDay', label: 'ساعت در روز' },
];

/*
 * Operators side by side.
 *
 * Two questions this answers that the payroll board cannot: who performs better over the same
 * amount of work, and how someone compares with how they themselves did in an earlier cycle.
 */
export default function ComparePage() {
  const [days, setDays] = useState(10);
  const [periodSeq, setPeriodSeq] = useState<number | undefined>();
  const [picked, setPicked] = useState<number[]>([]);
  const [metric, setMetric] = useState<Metric>(METRICS[0]);

  const board = useQuery({ queryKey: ['payroll-board'], queryFn: () => api<PeriodStatus[]>('/api/v1/payroll/board') });
  const people = board.data ?? [];
  // Cycle numbers anyone has reached, so a past cycle can be compared against too.
  const maxSeq = Math.max(1, ...people.map(p => p.seq));

  const params = new URLSearchParams({ days: String(days) });
  if (periodSeq) params.set('periodSeq', String(periodSeq));
  picked.forEach(id => params.append('userIds', String(id)));

  const q = useQuery({
    queryKey: ['compare', days, periodSeq, picked.join(',')],
    queryFn: () => api<Slice[]>(`/api/v1/payroll/compare?${params}`),
  });
  const rows = (q.data ?? []).filter(s => s.days > 0);

  const toggle = (id: number) =>
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">ارزیابی</span>
          <h1>مقایسه عملکرد پرسنل</h1>
          <p>هر نفر روی روزهای حضور خودش سنجیده می‌شود، نه روی بازه تقویمی مشترک.</p>
        </div>
      </header>

      <section className="toolbar compare-toolbar">
        <div className="segmented">
          {WINDOWS.map(w => (
            <button key={w.days} className={days === w.days ? 'active' : ''} onClick={() => setDays(w.days)}>
              {w.label}
            </button>
          ))}
        </div>
        <label>دوره
          <select value={periodSeq ?? ''} onChange={e => setPeriodSeq(e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">دوره جاری</option>
            {Array.from({ length: maxSeq }, (_, i) => i + 1).reverse().map(n => (
              <option key={n} value={n}>دوره {fa(n)}</option>
            ))}
          </select>
        </label>
      </section>

      {/* Everyone by default; picking narrows it. An empty selection meaning "all" avoids the
          dead first screen where nothing is chosen and nothing is shown. */}
      <div className="people-picker">
        <button className={picked.length ? '' : 'active'} onClick={() => setPicked([])}>
          همه ({fa(people.length)})
        </button>
        {people.map(p => (
          <button key={p.userId} className={picked.includes(p.userId) ? 'active' : ''}
                  onClick={() => toggle(p.userId)}>
            {p.displayName}
          </button>
        ))}
      </div>

      {q.isLoading ? <Loading /> : !rows.length ? (
        <div className="empty compact">در این بازه داده‌ای برای مقایسه نیست.</div>
      ) : (
        <>
          <section className="chart-card">
            <div className="section-title">
              <b>{metric.label}</b>
              <span>{days ? `${WINDOWS.find(w => w.days === days)?.label} هر نفر` : 'کل دوره'}</span>
            </div>
            <div className="metric-tabs">
              {METRICS.map(m => (
                <button key={String(m.key)} className={metric.key === m.key ? 'active' : ''}
                        onClick={() => setMetric(m)}>{m.label}</button>
              ))}
            </div>
            <Suspense fallback={<Loading />}>
              <CompareChart rows={rows} metricKey={String(metric.key)} label={metric.label} />
            </Suspense>
          </section>

          <section className="table-card">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>پرسنل</th><th>روز</th><th>ساعت</th><th>ساعت/روز</th>
                    <th>تماس</th><th>پاسخ مثبت</th><th>OK/روز</th><th>حاضرین</th>
                    <th>نرخ موفقیت</th><th>مانده ساعت</th><th>بازه واقعی</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(s => (
                    <tr key={s.userId}>
                      <td>{s.displayName}</td>
                      <td>{fa(s.days)}</td>
                      <td>{asHours(s.workedMinutes)}</td>
                      <td>{fa(s.hoursPerDay)}</td>
                      <td>{fa(s.contacted)}</td>
                      <td>{fa(s.ok)}</td>
                      <td>{fa(s.okPerDay)}</td>
                      <td>{fa(s.attendees)}</td>
                      <td>{fa(Math.round(s.successRate * 10) / 10)}٪</td>
                      <td className={s.balanceMinutes < 0 ? 'short' : 'ok'}>{signedHours(s.balanceMinutes)}</td>
                      {/* The calendar span differs per person, which is exactly the point. */}
                      <td className="span-cell">
                        {s.firstDay ? `${faDate(s.firstDay)} تا ${faDate(s.lastDay!)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="rule-note">
            بازه تقویمی هر نفر متفاوت است چون هر کس روزهای حضور خودش را دارد؛
            مقایسه روی تعداد روز برابر انجام می‌شود.
          </p>
        </>
      )}
    </div>
  );
}
