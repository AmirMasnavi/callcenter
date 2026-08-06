import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUrl, can, fa, faDate, Me } from '../lib/api';
import Loading from '../components/Loading';
import Icon from '../components/Icon';
import Sheet from '../components/Sheet';
import { asHours, signedHours } from './AttendancePage';

export interface PeriodStatus {
  periodId: number; userId: number; displayName: string; username: string; hasAvatar: boolean;
  seq: number; startedOn: string; endedOn: string | null; open: boolean;
  daysAttended: number; targetDays: number; shifts: number;
  workedMinutes: number; targetMinutes: number; balanceMinutes: number;
  carriedOverMinutes: number; dailyTargetMinutes: number;
  daysToMakeUp: number; readyToSettle: boolean;
  reports: number; contacted: number; ok: number; attendees: number; successRate: number;
  settlement: string | null; note: string | null; closedByName: string | null; closedAt: string | null;
}

const SETTLEMENTS = [
  { key: 'CARRY_OVER', label: 'انتقال کسری به دوره بعد',
    hint: 'ساعت کسری به سقف دوره بعدی اضافه می‌شود تا جبران شود.' },
  { key: 'EXTEND', label: 'جبران با روزهای اضافه',
    hint: 'دوره تا الان باز مانده و کسری با حضور بیشتر جبران شده است.' },
  { key: 'FORGIVE', label: 'چشم‌پوشی از کسری',
    hint: 'کسری بخشیده می‌شود و دوره بعدی کاملاً از نو شروع می‌شود.' },
] as const;

/*
 * The payroll board.
 *
 * These are project workers: a cycle is a count of days they turned up, not a stretch of
 * calendar. One person can finish today and another next month, so this lists PEOPLE and how
 * far each is through their own cycle — never a shared date range.
 */
export default function TimesheetPage() {
  const qc = useQueryClient();
  const me = qc.getQueryData<Me>(['me']);
  const [openUser, setOpenUser] = useState<number>();

  const q = useQuery({ queryKey: ['payroll-board'], queryFn: () => api<PeriodStatus[]>('/api/v1/payroll/board') });
  const rows = q.data ?? [];
  const due = rows.filter(r => r.readyToSettle);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">حقوق و دستمزد</span>
          <h1>دوره‌های کاری پرسنل</h1>
          <p>هر نفر پس از تکمیل روزهای حضور دوره‌اش، تسویه می‌شود — نه در تاریخ تقویمی ثابت.</p>
        </div>
        <div className="head-actions">
          {!!due.length && (
            <div className="due-count" title="این افراد روزهای دوره‌شان کامل شده است">
              <b>{fa(due.length)}</b><span>آماده تسویه</span>
            </div>
          )}
        </div>
      </header>

      {q.isLoading ? <Loading /> : (
        <section className="staff-list period-list">
          {rows.map(r => (
            <article key={r.userId} className={r.readyToSettle ? 'ready' : ''}>
              <button className="period-row" onClick={() => setOpenUser(r.userId)}>
                <div className="avatar">
                  {r.displayName.slice(0, 1)}
                  {r.hasAvatar && <img src={apiUrl(`/api/v1/users/${r.userId}/avatar`)} alt="" />}
                </div>
                <div className="staff-text">
                  <b>{r.displayName}</b>
                  <span>دوره {fa(r.seq)} · از {faDate(r.startedOn)}</span>
                </div>

                {/* Days are what the cycle is counted in, so they lead. */}
                <div className="days-cell">
                  <b>{fa(r.daysAttended)}<i>/{fa(r.targetDays)}</i></b>
                  <span>روز حضور</span>
                </div>

                {/*
                  * Hours are the check on top: did the days actually contain the time?
                  *
                  * Framing it as a shortfall only makes sense once the days are done. Someone
                  * on day 2 of 30 is "short" by the whole cycle, which is not news and reads
                  * as alarm — until the day count is met, the honest reading is progress.
                  */}
                <div className="hours-cell">
                  <b className={r.readyToSettle && r.balanceMinutes < 0 ? 'short' : ''}>
                    {asHours(r.workedMinutes)}
                  </b>
                  <span>
                    {r.readyToSettle
                      ? (r.daysToMakeUp > 0 ? `${fa(r.daysToMakeUp)} روز کسری ساعت` : 'ساعت کامل')
                      : `از ${asHours(r.targetMinutes)}`}
                  </span>
                </div>

                <div className="target-bar" title={`${fa(r.daysAttended)} از ${fa(r.targetDays)} روز`}>
                  <i style={{ width: `${Math.min(100, r.daysAttended / Math.max(1, r.targetDays) * 100)}%` }}
                     className={r.readyToSettle ? 'full' : r.daysAttended / r.targetDays >= 0.7 ? 'mid' : 'low'} />
                </div>

                {r.readyToSettle && <span className="ready-badge">آماده تسویه</span>}
              </button>
            </article>
          ))}
          {!rows.length && <div className="empty compact">پرسنلی یافت نشد.</div>}
        </section>
      )}

      {openUser !== undefined && (
        <EmployeeSheet userId={openUser} canSettle={can(me, 'CLOSE_PAYROLL_PERIOD')}
                       onClose={() => setOpenUser(undefined)}
                       onChanged={() => qc.invalidateQueries({ queryKey: ['payroll-board'] })} />
      )}
    </div>
  );
}

/**
 * One person's file: where they stand now, their settled history, and the controls.
 *
 * <p>Everything about a cycle is per person — its length, the expected hours a day, when it
 * settles — so this is where those live rather than in a global setting.
 */
function EmployeeSheet({ userId, canSettle, onClose, onChanged }: {
  userId: number; canSettle: boolean; onClose: () => void; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);

  const q = useQuery({
    queryKey: ['payroll-periods', userId],
    queryFn: () => api<PeriodStatus[]>(`/api/v1/payroll/employees/${userId}/periods`),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['payroll-periods', userId] }); onChanged(); };

  const setDays = useMutation({
    mutationFn: (targetDays: number) => api(`/api/v1/payroll/employees/${userId}/target-days`,
      { method: 'PUT', body: JSON.stringify({ targetDays }) }),
    onSuccess: () => { setError(''); refresh(); },
    onError: (e: Error) => setError(e.message),
  });

  const current = q.data?.find(p => p.open);
  const history = q.data?.filter(p => !p.open) ?? [];

  return (
    <Sheet onClose={onClose} labelledBy="employee-title">
      {q.isLoading || !current ? <Loading /> : (
        <>
          <h2 id="employee-title">{current.displayName}</h2>
          <p className="hint">دوره {fa(current.seq)} — از {faDate(current.startedOn)}</p>

          <div className="detail-stats">
            <div><span>روز حضور</span><b>{fa(current.daysAttended)} از {fa(current.targetDays)}</b></div>
            <div><span>ساعت کارکرد</span><b>{asHours(current.workedMinutes)}</b></div>
            <div className={current.balanceMinutes < 0 ? 'negative' : 'positive'}>
              <span>مانده تا سقف</span><b>{signedHours(current.balanceMinutes)}</b>
            </div>
            <div><span>تماس</span><b>{fa(current.contacted)}</b></div>
            <div><span>پاسخ مثبت</span><b>{fa(current.ok)}</b></div>
            <div><span>حاضرین</span><b>{fa(current.attendees)}</b></div>
          </div>

          {current.carriedOverMinutes > 0 && (
            <p className="rule-note">
              {asHours(current.carriedOverMinutes)} کسری از دوره قبل به سقف این دوره اضافه شده است.
            </p>
          )}

          {current.daysToMakeUp > 0 && current.readyToSettle && (
            <div className="banner warn compact">
              روزهای دوره کامل شده، اما {asHours(-current.balanceMinutes)} ساعت کسری دارد —
              حدود {fa(current.daysToMakeUp)} روز دیگر.
            </div>
          )}

          {canSettle && (
            <>
              <label className="day-picker">طول دوره (روز حضور)
                <input type="number" min={1} max={365} defaultValue={current.targetDays}
                       onBlur={e => { const v = Number(e.target.value);
                         if (v && v !== current.targetDays) setDays.mutate(v); }} />
              </label>
              <p className="hint">قرارداد هر نفر می‌تواند متفاوت باشد.</p>

              {error && <div className="error">{error}</div>}
              <button className="primary wide" onClick={() => setClosing(true)}>
                {current.readyToSettle ? 'تسویه و شروع دوره جدید' : 'بستن زودتر از موعد'}
              </button>
            </>
          )}

          <div className="export-options">
            <a className="export-option"
               href={apiUrl(`/api/v1/attendance/report.xlsx?from=${current.startedOn}&to=${new Date().toISOString().slice(0,10)}&userId=${userId}`)}>
              <Icon name="download" size={20} />
              <div><b>خروجی Excel این دوره</b><span>ریز شیفت‌های روزانه و جمع دوره.</span></div>
            </a>
          </div>

          {!!history.length && (
            <>
              <div className="section-title"><b>دوره‌های گذشته</b><span>{fa(history.length)} دوره</span></div>
              <div className="period-history">
                {history.map(p => (
                  <div key={p.periodId} className="settled-period">
                    <div>
                      <b>دوره {fa(p.seq)}</b>
                      <span>{faDate(p.startedOn)} تا {faDate(p.endedOn!)}</span>
                    </div>
                    <div>
                      <b>{fa(p.daysAttended)} روز · {asHours(p.workedMinutes)}</b>
                      <span className={p.balanceMinutes < 0 ? 'short' : 'ok'}>
                        {signedHours(p.balanceMinutes)}
                        {p.settlement && ' · ' + (SETTLEMENTS.find(s => s.key === p.settlement)?.label ?? p.settlement)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {closing && current && (
        <CloseSheet status={current} onClose={() => setClosing(false)}
                    onClosed={() => { setClosing(false); refresh(); }} />
      )}
    </Sheet>
  );
}

/**
 * Settling. The shortfall resolution is deliberately a choice, not a rule — whether someone
 * works it off, carries it, or is let off is a judgement about that person.
 */
function CloseSheet({ status, onClose, onClosed }: {
  status: PeriodStatus; onClose: () => void; onClosed: () => void;
}) {
  const short = status.balanceMinutes < 0;
  const [settlement, setSettlement] = useState<string>(short ? 'CARRY_OVER' : 'FORGIVE');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const close = useMutation({
    mutationFn: () => api(`/api/v1/payroll/employees/${status.userId}/close`,
      { method: 'POST', body: JSON.stringify({ settlement, note: note || null }) }),
    onSuccess: onClosed,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Sheet onClose={onClose} labelledBy="close-title">
      <h2 id="close-title">تسویه دوره — {status.displayName}</h2>
      <p className="hint">
        ارقام این دوره قفل می‌شود و دوره جدید از فردا شروع می‌شود. اصلاح شیفت‌ها پس از این،
        در دوره جدید حساب می‌شود.
      </p>

      <div className="equation valid">
        <span>{fa(status.daysAttended)} روز حضور · {asHours(status.workedMinutes)}</span>
        <b>{signedHours(status.balanceMinutes)}</b>
      </div>

      {short ? (
        <>
          <p className="hint">
            {asHours(-status.balanceMinutes)} ساعت کسری دارد (حدود {fa(status.daysToMakeUp)} روز).
            تکلیف آن را مشخص کنید:
          </p>
          <div className="settlement-options">
            {SETTLEMENTS.map(s => (
              <label key={s.key} className={'settlement-option' + (settlement === s.key ? ' selected' : '')}>
                <input type="radio" name="settlement" value={s.key}
                       checked={settlement === s.key} onChange={() => setSettlement(s.key)} />
                <div><b>{s.label}</b><span>{s.hint}</span></div>
              </label>
            ))}
          </div>
        </>
      ) : (
        <p className="hint">ساعت کسری ندارد؛ دوره بدون بدهی بسته می‌شود.</p>
      )}

      <label className="day-picker">توضیح
        <input value={note} maxLength={300} onChange={e => setNote(e.target.value)}
               placeholder="مثلاً: حقوق دوره پرداخت شد" />
      </label>

      {error && <div className="error">{error}</div>}
      <button className="primary wide" disabled={close.isPending}
              onClick={() => { setError(''); close.mutate(); }}>
        {close.isPending ? 'در حال تسویه…' : 'تسویه و شروع دوره جدید'}
      </button>
    </Sheet>
  );
}
