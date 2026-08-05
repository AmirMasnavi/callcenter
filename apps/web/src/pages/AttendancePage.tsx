import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUrl, can, fa, faDateTime, Me } from '../lib/api';
import Loading from '../components/Loading';
import Icon from '../components/Icon';
import Sheet from '../components/Sheet';
import JalaliDate, { todayIso } from '../components/JalaliDate';
import { DateObject } from 'react-multi-date-picker';
import gregorian from 'react-date-object/calendars/gregorian';

interface StaffState {
  userId: number; displayName: string; username: string; hasAvatar: boolean;
  openEntryId: number | null; openSince: string | null;
  todayMinutes: number; shiftsToday: number;
}

/**
 * Minutes as "۴:۳۰" — the form is read in hours and minutes, not decimals.
 *
 * Both halves go through the Persian formatter. Padding the minutes with String() left them
 * in Latin digits, so every total on the page read "۳:12".
 */
export const asHours = (minutes: number) => {
  const mins = Math.abs(minutes % 60);
  return `${fa(Math.floor(minutes / 60))}:${fa(mins).padStart(2, '۰')}`;
};

/**
 * A balance against the target: "۳:۲۰+" over, "۵:۱۰−" under.
 *
 * The sign is what payroll actually reads — "how many hours short are they" is the question,
 * and an unsigned figure leaves you working out which side of the target it falls on.
 */
export const signedHours = (minutes: number) =>
  `${asHours(Math.abs(minutes))}${minutes < 0 ? '−' : '+'}`;

const pad = (n: number) => String(n).padStart(2, '0');

/** A local <input type="datetime-local"> value from an instant, for the adjust dialog. */
const toLocalInput = (iso: string | Date) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const clock = (iso: string) =>
  new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' })
    .format(new Date(iso));
const faDayOf = (d: Date) =>
  new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long', day: 'numeric' }).format(d);

/*
 * The front desk screen.
 *
 * One tap records the moment; the exact time can then be nudged, because the clock rarely
 * matches when someone actually walked through the door. Everyone is on one list with
 * their state visible, so it is obvious at a glance who is still in.
 */
export default function AttendancePage() {
  const qc = useQueryClient();
  /*
   * A manager holds VIEW_PRESENCE but not RECORD_ATTENDANCE: they want to know who is in the
   * building, while recording stays the front desk's job. Rather than a second page that
   * would drift out of step, the same board drops its controls.
   */
  const canRecord = can(qc.getQueryData<Me>(['me']), 'RECORD_ATTENDANCE');
  const q = useQuery({
    queryKey: ['attendance-today'],
    queryFn: () => api<StaffState[]>('/api/v1/attendance/today'),
    refetchInterval: 60_000,
  });
  const [query, setQuery] = useState('');
  const [adjusting, setAdjusting] = useState<StaffState>();
  const [manualFor, setManualFor] = useState<StaffState | null>();
  const [error, setError] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['attendance-today'] });

  const clockIn = useMutation({
    mutationFn: (s: StaffState) => api(`/api/v1/attendance/${s.userId}/in`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => { setError(''); refresh(); },
    onError: (e: Error) => setError(e.message),
  });
  const clockOut = useMutation({
    mutationFn: (s: StaffState) => api(`/api/v1/attendance/entries/${s.openEntryId}/out`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => { setError(''); refresh(); },
    onError: (e: Error) => setError(e.message),
  });

  const shown = (q.data ?? []).filter(s => !query.trim() || `${s.displayName} ${s.username}`.includes(query.trim()));
  const inBuilding = (q.data ?? []).filter(s => s.openEntryId).length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">حضور و غیاب</span>
          <h1>{canRecord ? 'ورود و خروج پرسنل' : 'حاضرین امروز'}</h1>
          <p>{canRecord
            ? 'زمان با یک لمس ثبت می‌شود و در صورت نیاز قابل اصلاح است.'
            : 'وضعیت لحظه‌ای پرسنل. ثبت ورود و خروج بر عهده مسئول دفتر است.'}</p>
        </div>
        <div className="head-actions">
          <div className="attendance-count">
            <b>{fa(inBuilding)}</b><span>نفر حاضر</span>
          </div>
          {/* Someone forgets to check in, or the desk is unattended — the day still has to
              be recordable afterwards. */}
          {canRecord && (
            <button className="secondary" onClick={() => setManualFor(shown[0] ?? null)}>
              <Icon name="plus" size={16} /><span>ثبت دستی</span>
            </button>
          )}
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="search-field">
        <Icon name="search" size={18} />
        <input value={query} onChange={e => setQuery(e.target.value)}
               placeholder="جست‌وجوی پرسنل…" aria-label="جست‌وجوی پرسنل" />
      </div>

      {q.isLoading ? <Loading /> : (
        <section className="staff-list">
          {shown.map(s => (
            <article key={s.userId} className={s.openEntryId ? 'present' : ''}>
              <div className="avatar">
                {s.displayName.slice(0, 1)}
                {s.hasAvatar && <img src={apiUrl(`/api/v1/users/${s.userId}/avatar`)} alt="" />}
              </div>
              <div className="staff-text">
                <b>{s.displayName}</b>
                <span>
                  {s.openEntryId
                    ? `از ${faDateTime(s.openSince!)} داخل است`
                    : s.shiftsToday
                      ? `امروز ${asHours(s.todayMinutes)} ساعت · ${fa(s.shiftsToday)} شیفت`
                      : 'امروز ثبت نشده'}
                </span>
              </div>

              {canRecord ? (
                <>
                  {s.openEntryId ? (
                    <button className="danger clock-btn" disabled={clockOut.isPending}
                            onClick={() => clockOut.mutate(s)}>ثبت خروج</button>
                  ) : (
                    <button className="primary clock-btn" disabled={clockIn.isPending}
                            onClick={() => clockIn.mutate(s)}>ثبت ورود</button>
                  )}
                  <button className="icon-button" title="اصلاح زمان" onClick={() => setAdjusting(s)}>
                    <Icon name="edit" size={16} label={`اصلاح زمان ${s.displayName}`} />
                  </button>
                </>
              ) : (
                <span className={'presence-tag ' + (s.openEntryId ? 'in' : s.shiftsToday ? 'left' : 'absent')}>
                  {s.openEntryId ? 'داخل' : s.shiftsToday ? 'رفته' : 'نیامده'}
                </span>
              )}
            </article>
          ))}
          {!shown.length && <div className="empty compact">پرسنلی پیدا نشد.</div>}
        </section>
      )}

      {adjusting && (
        <AdjustSheet staff={adjusting} onClose={() => setAdjusting(undefined)}
                     onSaved={() => { setAdjusting(undefined); refresh(); }} />
      )}
      {manualFor !== undefined && (
        <ManualSheet staff={manualFor} everyone={q.data ?? []}
                     onClose={() => setManualFor(undefined)}
                     onSaved={() => { setManualFor(undefined); refresh(); }} />
      )}
    </div>
  );
}

interface EntryView {
  id: number; entryAt: string; exitAt: string | null; workedMinutes: number; note: string | null;
}

function AdjustSheet({ staff, onClose, onSaved }: { staff: StaffState; onClose: () => void; onSaved: () => void }) {
  // Corrections are rarely for today — a missed day is usually noticed later.
  // todayIso() is Tehran's date. toISOString() would be UTC's, which lands on the wrong
  // day every evening and would preselect — and cap at — yesterday.
  const [date, setDate] = useState(todayIso);
  const q = useQuery({
    queryKey: ['attendance-entries', staff.userId, date],
    queryFn: () => api<EntryView[]>(`/api/v1/attendance/${staff.userId}/entries?date=${date}`),
  });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: (e: { id: number; entryAt: string; exitAt: string | null; note: string }) =>
      api(`/api/v1/attendance/entries/${e.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          entryAt: new Date(e.entryAt).toISOString(),
          exitAt: e.exitAt ? new Date(e.exitAt).toISOString() : null,
          note: e.note || null,
        }),
      }),
    onSuccess: () => { setError(''); qc.invalidateQueries({ queryKey: ['attendance-entries'] }); onSaved(); },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/attendance/entries/${id}`, { method: 'DELETE' }),
    onSuccess: onSaved,
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Sheet onClose={onClose} labelledBy="adjust-title">
      <h2 id="adjust-title">اصلاح زمان — {staff.displayName}</h2>
      <label className="day-picker">تاریخ
        <JalaliDate value={date} onChange={setDate} />
      </label>
      <p className="hint">زمان‌ها را می‌توانید دقیقه‌به‌دقیقه تنظیم کنید.</p>
      {error && <div className="error">{error}</div>}
      {q.isLoading ? <Loading /> : (
        <div className="shift-edit-list">
          {q.data?.length ? q.data.map(e => (
            <ShiftRow key={e.id} entry={e}
                      onSave={(entryAt, exitAt, note) => save.mutate({ id: e.id, entryAt, exitAt, note })}
                      onDelete={() => remove.mutate(e.id)} busy={save.isPending || remove.isPending} />
          )) : <div className="empty compact">در این روز شیفتی ثبت نشده است.</div>}
        </div>
      )}
    </Sheet>
  );
}

function ShiftRow({ entry, onSave, onDelete, busy }: {
  entry: EntryView;
  onSave: (entryAt: string, exitAt: string | null, note: string) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [entryAt, setEntryAt] = useState(toLocalInput(entry.entryAt));
  const [exitAt, setExitAt] = useState(entry.exitAt ? toLocalInput(entry.exitAt) : '');
  const [note, setNote] = useState(entry.note ?? '');
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="shift-edit">
      <label>ورود<input type="datetime-local" value={entryAt} onChange={e => setEntryAt(e.target.value)} /></label>
      <label>خروج<input type="datetime-local" value={exitAt} onChange={e => setExitAt(e.target.value)} /></label>
      <label>توضیح<input value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="اختیاری" /></label>
      {/* Deleting a shift removes paid hours and cannot be undone, so it asks first. Clearing
          the exit instead is the non-destructive way to mark a shift still running. */}
      {confirming ? (
        <div className="admin-action-row confirm-row">
          <span>این شیفت حذف شود؟</span>
          <button className="danger" disabled={busy} onClick={onDelete}>حذف</button>
          <button className="secondary" disabled={busy} onClick={() => setConfirming(false)}>انصراف</button>
        </div>
      ) : (
        <div className="admin-action-row">
          <button className="primary" disabled={busy} onClick={() => onSave(entryAt, exitAt || null, note)}>ذخیره</button>
          <button className="icon-button danger-ghost" disabled={busy}
                  onClick={() => setConfirming(true)} title="حذف شیفت">
            <Icon name="trash" size={16} label="حذف شیفت" />
          </button>
        </div>
      )}
    </div>
  );
}

/** The usual shift, offered as the starting point rather than an empty form. */
const DEFAULT_ENTRY = '14:00';
const DEFAULT_EXIT = '19:00';

/**
 * The most recent day on which that shift has actually finished.
 *
 * Opening on today would show "این زمان هنوز نرسیده است" every morning, because the default
 * window is still ahead — an error before the desk has typed anything. A day nobody recorded
 * is by definition a day that has already passed, so start on the last one that has.
 */
const lastCompleteDay = () => {
  const today = todayIso();
  const nowInTehran = new Intl.DateTimeFormat('en-GB',
    { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date());
  if (nowInTehran >= DEFAULT_EXIT) return today;
  const d = new DateObject({ date: today, format: 'YYYY-MM-DD', calendar: gregorian });
  d.subtract(1, 'days');
  return d.format('YYYY-MM-DD');
};

/**
 * Records a whole shift after the fact.
 *
 * Defaults to a plausible shift on a day that has already ended, so the common case is two
 * taps, but every field is editable — the point of this sheet is that the desk was not there.
 */
function ManualSheet({ staff, everyone, onClose, onSaved }: {
  staff: StaffState | null;
  everyone: StaffState[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [userId, setUserId] = useState(staff?.userId ?? everyone[0]?.userId ?? 0);
  const [date, setDate] = useState(lastCompleteDay);
  const [entryTime, setEntryTime] = useState(DEFAULT_ENTRY);
  const [exitTime, setExitTime] = useState(DEFAULT_EXIT);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  /*
   * An exit time at or before the entry time means the shift ran past midnight, which the
   * paper form recorded as one line. Treating it as "same day" instead made a night shift
   * impossible to enter at all.
   */
  const entryAt = new Date(`${date}T${entryTime}`);
  const exitAt = new Date(`${date}T${exitTime}`);
  const overnight = exitAt <= entryAt;
  if (overnight) exitAt.setDate(exitAt.getDate() + 1);

  const minutes = Math.round((exitAt.getTime() - entryAt.getTime()) / 60000);
  const inFuture = exitAt.getTime() > Date.now();

  // What is already on the books for that person and day, so the same shift is not filed twice.
  const existing = useQuery({
    queryKey: ['attendance-entries', userId, date],
    queryFn: () => api<EntryView[]>(`/api/v1/attendance/${userId}/entries?date=${date}`),
    enabled: !!userId,
  });

  const save = useMutation({
    mutationFn: () => api(`/api/v1/attendance/${userId}/manual`, {
      method: 'POST',
      // Built from local times, so what the desk typed is what gets stored.
      body: JSON.stringify({
        entryAt: entryAt.toISOString(),
        exitAt: exitAt.toISOString(),
        note: note || null,
      }),
    }),
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Sheet onClose={onClose} labelledBy="manual-title">
      <h2 id="manual-title">ثبت دستی ورود و خروج</h2>
      <p className="hint">برای روزهایی که در لحظه ثبت نشده‌اند.</p>

      <div className="filter-sheet">
        <label>پرسنل
          <select value={userId} onChange={e => setUserId(Number(e.target.value))}>
            {everyone.map(s => <option key={s.userId} value={s.userId}>{s.displayName}</option>)}
          </select>
        </label>
        <label>تاریخ
          <JalaliDate value={date} onChange={setDate} />
        </label>
        <div className="time-pair">
          <label>ساعت ورود
            <input type="time" value={entryTime} onChange={e => setEntryTime(e.target.value)} />
          </label>
          <label>ساعت خروج
            <input type="time" value={exitTime} onChange={e => setExitTime(e.target.value)} />
          </label>
        </div>
        <label>توضیح
          <input value={note} maxLength={300} onChange={e => setNote(e.target.value)}
                 placeholder="مثلاً: در لحظه ثبت نشد" />
        </label>
      </div>

      {/* The computed duration is shown before saving, so a wrong time is obvious here
          rather than in the payroll report a month later. */}
      <div className={'equation ' + (inFuture ? 'invalid' : 'valid')}>
        <span>مدت محاسبه‌شده</span>
        <b>{inFuture ? 'این زمان هنوز نرسیده است' : asHours(minutes)}</b>
      </div>
      {overnight && !inFuture && (
        <p className="hint">شیفت شبانه: خروج در بامداد {faDayOf(exitAt)} ثبت می‌شود.</p>
      )}

      {/* Recording the same shift twice is the easy mistake here, so what is already on the
          books for that day is visible before saving. */}
      {!!existing.data?.length && (
        <div className="existing-shifts">
          <span>قبلاً برای این روز ثبت شده:</span>
          <ul>
            {existing.data.map(e => (
              <li key={e.id}>
                {clock(e.entryAt)} تا {e.exitAt ? clock(e.exitAt) : '—'}
                {e.exitAt && ` · ${asHours(e.workedMinutes)}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="error">{error}</div>}
      <button className="primary wide" disabled={!minutes || inFuture || !userId || save.isPending}
              onClick={() => { setError(''); save.mutate(); }}>
        {save.isPending ? 'در حال ثبت…' : 'ثبت شیفت'}
      </button>
    </Sheet>
  );
}
