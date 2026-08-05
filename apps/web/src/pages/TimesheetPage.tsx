import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUrl, can, fa, faDate, Me } from '../lib/api';
import Loading from '../components/Loading';
import Icon from '../components/Icon';
import JalaliDate, { todayIso } from '../components/JalaliDate';
import Sheet from '../components/Sheet';
import { asHours, signedHours } from './AttendancePage';

/* ECharts is ~1MB. The list and the totals are what people come for; the chart can arrive a
   moment later rather than delaying the whole screen. */
const HoursChart = lazy(() => import('../components/HoursChart'));

export interface StaffSummary {
  userId: number; displayName: string; username: string;
  workedMinutes: number; daysPresent: number; shifts: number;
  expectedDays: number; daysShort: number;
  dailyTargetMinutes: number; targetMinutes: number; targetPercent: number;
  reports: number; contacted: number; ok: number; attendees: number; successRate: number;
}
interface DayRow { date: string; workedMinutes: number; shifts: { id: number; entryAt: string; exitAt: string | null; workedMinutes: number; note: string | null }[] }
interface StaffDetail { summary: StaffSummary; days: DayRow[] }
interface Period {
  id: number; startsOn: string; endsOn: string; open: boolean;
  closedAt: string | null; closedByName: string | null; note: string | null;
  expectedDays: number; people: number; totalMinutes: number; totalTargetMinutes: number;
}

/*
 * Presets are counted in WORKING days, not calendar days.
 *
 * "۳۰ روز" is a pay cycle of thirty days somebody was due in. Counting Fridings into it would
 * quietly lower the target, so the server resolves the window and both sides agree on where
 * the weekend falls.
 */
const PRESETS = [10, 15, 30];
const timeOf = (iso: string) => new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }).format(new Date(iso));

/*
 * Payroll view: worked hours and call performance for the same window, side by side.
 *
 * Hours come from real clock times, and the target comes from the window: expected working
 * days × five hours. That is the question the paper process could never answer — not "did
 * they show up" but "did the hours add up over the days they were due in".
 */
export default function TimesheetPage() {
  const qc = useQueryClient();
  const me = qc.getQueryData<Me>(['me']);
  const [range, setRange] = useState<{ from: string; to: string; preset?: number }>();
  const [openUser, setOpenUser] = useState<number>();
  const [exporting, setExporting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [printJob, setPrintJob] = useState<{ userId?: number } | null>(null);

  const periods = useQuery({ queryKey: ['payroll-periods'], queryFn: () => api<Period[]>('/api/v1/payroll/periods') });
  const currentPeriod = periods.data?.find(p => p.open);

  /*
   * Open on a cycle that has actually started.
   *
   * Closing a period opens the next one the following day, so for the rest of the closing day
   * the "current" cycle lies entirely in the future — landing there shows an empty chart and
   * a zero total, which reads as a broken screen rather than a period that has not begun. The
   * most recently settled cycle is what someone is looking at on that day anyway.
   */
  useEffect(() => {
    if (range || !periods.data?.length) return;
    const today = todayIso();
    const started = periods.data.find(p => p.startsOn <= today) ?? periods.data[0];
    setRange({ from: started.startsOn, to: started.endsOn });
  }, [range, periods.data]);

  const from = range?.from ?? '', to = range?.to ?? '';
  const q = useQuery({
    queryKey: ['timesheet', from, to],
    queryFn: () => api<StaffSummary[]>(`/api/v1/attendance/report?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  async function applyPreset(days: number) {
    const w = await api<{ from: string; to: string }>(`/api/v1/attendance/window?days=${days}`);
    setRange({ ...w, preset: days });
  }

  const rows = q.data ?? [];
  const totalMinutes = rows.reduce((sum, r) => sum + r.workedMinutes, 0);
  const totalTarget = rows.reduce((sum, r) => sum + r.targetMinutes, 0);
  const expectedDays = rows[0]?.expectedDays ?? 0;
  const dailyHours = (rows[0]?.dailyTargetMinutes ?? 300) / 60;
  const stopPrinting = useCallback(() => setPrintJob(null), []);

  if (!range) return <Loading />;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">حقوق و دستمزد</span>
          <h1>ساعات کاری پرسنل</h1>
          <p>ساعات واقعی کارکرد در برابر سقف همین بازه، نه سقف ماهانه.</p>
        </div>
        <div className="head-actions">
          <button className="icon-button" onClick={() => setExporting(true)} title="خروجی گرفتن از همین بازه">
            <Icon name="download" label="خروجی" /><span className="btn-label">خروجی</span>
          </button>
          {can(me, 'CLOSE_PAYROLL_PERIOD') && currentPeriod && (
            <button className="secondary" onClick={() => setClosing(true)}>
              <Icon name="check" size={16} /><span>بستن دوره</span>
            </button>
          )}
        </div>
      </header>

      {/* The open cycle, and what has been settled before it. */}
      <PeriodBar periods={periods.data ?? []} range={range} onPick={(p) =>
        setRange({ from: p.startsOn, to: p.endsOn })} />

      <section className="toolbar timesheet-range">
        <div className="segmented range-presets">
          {PRESETS.map(d => (
            <button key={d} className={range.preset === d ? 'active' : ''} onClick={() => applyPreset(d)}>
              {fa(d)} روز کاری
            </button>
          ))}
        </div>
        <label>از<JalaliDate value={from} onChange={v => setRange({ from: v, to })} max={false} /></label>
        <label>تا<JalaliDate value={to} onChange={v => setRange({ from, to: v })} /></label>
        <div className="range-total">
          <span>جمع کل</span><b>{asHours(totalMinutes)}</b>
        </div>
      </section>

      {/* States the rule the numbers below are judged by, so nobody has to infer it. */}
      {!!expectedDays && (
        <p className="rule-note">
          {fa(expectedDays)} روز کاری در این بازه × {fa(dailyHours)} ساعت ={' '}
          <b>{asHours(totalTarget / Math.max(1, rows.length))}</b> سقف هر نفر
          {' · '}جمع تیم <b>{asHours(totalTarget)}</b>
        </p>
      )}

      {printJob && <PrintableTimesheet from={from} to={to} userId={printJob.userId} onDone={stopPrinting} />}
      {exporting && (
        <ExportSheet from={from} to={to} rows={rows} onClose={() => setExporting(false)}
                     onPrint={(userId) => { setExporting(false); setPrintJob({ userId }); }} />
      )}
      {closing && currentPeriod && (
        <ClosePeriodSheet period={currentPeriod} onClose={() => setClosing(false)}
                          onClosed={() => {
                            setClosing(false); setRange(undefined);
                            qc.invalidateQueries({ queryKey: ['payroll-periods'] });
                            qc.invalidateQueries({ queryKey: ['timesheet'] });
                          }} />
      )}

      {q.isLoading ? <Loading /> : (
        <>
          <section className="chart-card">
            <div className="section-title"><b>کارکرد در برابر سقف بازه</b><span>{faDate(from)} تا {faDate(to)}</span></div>
            {rows.length
              ? <Suspense fallback={<Loading />}><HoursChart rows={rows} /></Suspense>
              : <div className="empty compact">در این بازه ساعتی ثبت نشده است.</div>}
          </section>

          <section className="staff-list timesheet-list">
            {rows.map(r => (
              <article key={r.userId}>
                <button className="timesheet-row" onClick={() => setOpenUser(openUser === r.userId ? undefined : r.userId)}>
                  <div className="staff-text">
                    <b>{r.displayName}</b>
                    <span>
                      {fa(r.daysPresent)} از {fa(r.expectedDays)} روز · {fa(r.shifts)} شیفت
                    </span>
                  </div>
                  <div className="hours-cell">
                    <b>{asHours(r.workedMinutes)}</b>
                    <span>از {asHours(r.targetMinutes)}</span>
                  </div>
                  {/* Turning up for eight of ten days and turning up late every day are
                      different problems, so the day shortfall is called out separately. */}
                  {r.daysShort > 0 && (
                    <span className="short-badge" title={`${fa(r.daysShort)} روز اصلاً حضور نداشته است`}>
                      −{fa(r.daysShort)} روز
                    </span>
                  )}
                  <div className="target-bar" title={`${fa(Math.round(r.targetPercent))}٪`}>
                    <i style={{ width: `${Math.min(100, r.targetPercent)}%` }}
                       className={r.targetPercent >= 100 ? 'full' : r.targetPercent >= 85 ? 'mid' : 'low'} />
                  </div>
                  <i className="chev" aria-hidden="true">{openUser === r.userId ? '⌃' : '⌄'}</i>
                </button>

                {openUser === r.userId && (
                  <StaffDetailView userId={r.userId} from={from} to={to} summary={r}
                                   onPrint={() => setPrintJob({ userId: r.userId })} />
                )}
              </article>
            ))}
            {!rows.length && <div className="empty compact">پرسنلی در این بازه یافت نشد.</div>}
          </section>
        </>
      )}
    </div>
  );
}

/** Closed cycles stay reachable: they are the record of what was actually paid. */
function PeriodBar({ periods, range, onPick }: {
  periods: Period[]; range: { from: string; to: string }; onPick: (p: Period) => void;
}) {
  if (!periods.length) return null;
  return (
    <div className="period-bar">
      {periods.slice(0, 6).map(p => {
        const active = p.startsOn === range.from && p.endsOn === range.to;
        // The cycle after a close begins tomorrow; saying so beats an unexplained empty screen.
        const notYet = p.open && p.startsOn > todayIso();
        return (
          <button key={p.id} className={(active ? 'active ' : '') + (p.open ? 'open' : 'settled')}
                  onClick={() => onPick(p)}
                  title={p.open ? 'دوره جاری' : `بسته‌شده${p.closedByName ? ' توسط ' + p.closedByName : ''}`}>
            <b>{notYet ? 'دوره بعدی' : p.open ? 'دوره جاری' : faDate(p.endsOn)}</b>
            <span>{faDate(p.startsOn)} تا {faDate(p.endsOn)}</span>
            <small>
              {notYet ? 'هنوز شروع نشده' : `${asHours(p.totalMinutes)} از ${asHours(p.totalTargetMinutes)}`}
            </small>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Settling a cycle.
 *
 * <p>Deliberately a two-step confirmation with the figures in front of you: it freezes what
 * everyone worked and cannot be undone, because a reopenable period is not a record.
 */
function ClosePeriodSheet({ period, onClose, onClosed }: {
  period: Period; onClose: () => void; onClosed: () => void;
}) {
  const [endsOn, setEndsOn] = useState(period.endsOn);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const close = useMutation({
    mutationFn: () => api('/api/v1/payroll/periods/close', {
      method: 'POST', body: JSON.stringify({ endsOn, note: note || null }),
    }),
    onSuccess: onClosed,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Sheet onClose={onClose} labelledBy="close-period-title">
      <h2 id="close-period-title">بستن دوره حقوق</h2>
      <p className="hint">
        ساعات این بازه ثبت و قفل می‌شود و دوره بعدی از روز بعد شروع می‌شود. اصلاح شیفت‌ها پس از
        این، در دوره جدید حساب می‌شود.
      </p>

      <div className="filter-sheet">
        <label>پایان دوره<JalaliDate value={endsOn} onChange={setEndsOn} /></label>
        <label>توضیح
          <input value={note} maxLength={300} onChange={e => setNote(e.target.value)}
                 placeholder="مثلاً: حقوق مرداد پرداخت شد" />
        </label>
      </div>

      <div className="equation valid">
        <span>{fa(period.people)} نفر · {fa(period.expectedDays)} روز کاری</span>
        <b>{asHours(period.totalMinutes)} از {asHours(period.totalTargetMinutes)}</b>
      </div>

      {error && <div className="error">{error}</div>}
      <button className="primary wide" disabled={close.isPending} onClick={() => { setError(''); close.mutate(); }}>
        {close.isPending ? 'در حال بستن…' : 'بستن دوره و شروع دوره بعد'}
      </button>
    </Sheet>
  );
}

/**
 * One place to get data out, that says what it will produce.
 *
 * <p>Two unlabelled icons meant nobody could tell what "print" was for or whether an export
 * followed the filters. Both questions are answered on the sheet: the range is stated at the
 * top, and each option describes its output in a sentence.
 */
function ExportSheet({ from, to, rows, onClose, onPrint }: {
  from: string; to: string; rows: StaffSummary[];
  onClose: () => void; onPrint: (userId?: number) => void;
}) {
  const [who, setWho] = useState<number | 'all'>('all');
  const target = who === 'all' ? undefined : rows.find(r => r.userId === who);
  const scope = who === 'all' ? `${fa(rows.length)} نفر` : target?.displayName ?? '';

  const xlsxUrl = apiUrl(`/api/v1/attendance/report.xlsx?from=${from}&to=${to}`
    + (who === 'all' ? '' : `&userId=${who}`));

  return (
    <Sheet onClose={onClose} labelledBy="export-title">
      <h2 id="export-title">خروجی گرفتن</h2>

      {/* Stating the range removes the doubt about whether an export follows the filters. */}
      <div className="export-scope">
        <span>بازه انتخاب‌شده</span>
        <b>{faDate(from)} تا {faDate(to)}</b>
      </div>

      <div className="filter-sheet">
        <label>برای
          <select value={who} onChange={e => setWho(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">همه پرسنل ({fa(rows.length)} نفر)</option>
            {rows.map(r => <option key={r.userId} value={r.userId}>{r.displayName}</option>)}
          </select>
        </label>
      </div>

      <div className="export-options">
        <a className="export-option" href={xlsxUrl} onClick={onClose}>
          <Icon name="download" size={20} />
          <div>
            <b>فایل Excel</b>
            <span>جدول خلاصه و ریز شیفت‌های روزانه برای {scope} — برای محاسبه و بایگانی دیجیتال.</span>
          </div>
        </a>

        <button className="export-option" onClick={() => onPrint(who === 'all' ? undefined : who)}>
          <Icon name="sheet" size={20} />
          <div>
            <b>فرم امضا (چاپ / PDF)</b>
            <span>
              همان فرم کاغذی حضور و غیاب، پرشده: یک برگ برای هر نفر با ستون امضا و جمع بازه.
              برای امضای پرسنل و بایگانی در پرونده حقوق.
            </span>
          </div>
        </button>
      </div>
    </Sheet>
  );
}

function StaffDetailView({ userId, from, to, summary, onPrint }: {
  userId: number; from: string; to: string; summary: StaffSummary; onPrint: () => void;
}) {
  const q = useQuery({
    queryKey: ['timesheet-detail', userId, from, to],
    queryFn: () => api<StaffDetail>(`/api/v1/attendance/report/${userId}?from=${from}&to=${to}`),
  });
  const balance = summary.workedMinutes - summary.targetMinutes;

  return (
    <div className="timesheet-detail">
      {/* Hours alone do not say whether the time was productive — the call figures for the
          same window sit right beside them. */}
      <div className="detail-stats">
        <div className={balance < 0 ? 'negative' : 'positive'}>
          <span>مانده تا سقف</span><b>{signedHours(balance)}</b>
        </div>
        <div><span>گزارش</span><b>{fa(summary.reports)}</b></div>
        <div><span>تماس</span><b>{fa(summary.contacted)}</b></div>
        <div><span>پاسخ مثبت</span><b>{fa(summary.ok)}</b></div>
        <div><span>حاضرین</span><b>{fa(summary.attendees)}</b></div>
        <div><span>نرخ موفقیت</span><b>{fa(Math.round(summary.successRate * 10) / 10)}٪</b></div>
      </div>

      <div className="detail-actions">
        <a className="secondary" href={apiUrl(`/api/v1/attendance/report.xlsx?from=${from}&to=${to}&userId=${userId}`)}>
          <Icon name="download" size={16} /><span>Excel این نفر</span>
        </a>
        <button className="secondary" onClick={onPrint}>
          <Icon name="sheet" size={16} /><span>فرم امضای این نفر</span>
        </button>
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
function PrintableTimesheet({ from, to, userId, onDone }: {
  from: string; to: string; userId?: number; onDone: () => void;
}) {
  const details = useQuery({
    queryKey: ['print-timesheet', from, to, userId ?? 'all'],
    queryFn: async () => userId
      ? [await api<StaffDetail>(`/api/v1/attendance/report/${userId}?from=${from}&to=${to}`)]
      : api<StaffDetail[]>(`/api/v1/attendance/report/details?from=${from}&to=${to}`),
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
              <span><b>روزهای حضور:</b> {fa(d.summary.daysPresent)} از {fa(d.summary.expectedDays)}</span>
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
                  سقف بازه {asHours(d.summary.targetMinutes)} ({fa(Math.round(d.summary.targetPercent))}٪)
                  {' — مانده '}{signedHours(d.summary.workedMinutes - d.summary.targetMinutes)}
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
