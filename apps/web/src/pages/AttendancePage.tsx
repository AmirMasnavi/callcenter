import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUrl, fa, faDateTime } from '../lib/api';
import Loading from '../components/Loading';
import Icon from '../components/Icon';
import Sheet from '../components/Sheet';

interface StaffState {
  userId: number; displayName: string; username: string; hasAvatar: boolean;
  openEntryId: number | null; openSince: string | null;
  todayMinutes: number; shiftsToday: number;
}

/** Minutes as "۴:۳۰" — the form is read in hours and minutes, not decimals. */
export const asHours = (minutes: number) =>
  `${fa(Math.floor(minutes / 60))}:${String(Math.abs(minutes % 60)).padStart(2, '0')}`;

/** A local <input type="datetime-local"> value from an instant, for the adjust dialog. */
const toLocalInput = (iso: string | Date) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/*
 * The front desk screen.
 *
 * One tap records the moment; the exact time can then be nudged, because the clock rarely
 * matches when someone actually walked through the door. Everyone is on one list with
 * their state visible, so it is obvious at a glance who is still in.
 */
export default function AttendancePage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['attendance-today'],
    queryFn: () => api<StaffState[]>('/api/v1/attendance/today'),
    refetchInterval: 60_000,
  });
  const [query, setQuery] = useState('');
  const [adjusting, setAdjusting] = useState<StaffState>();
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
          <h1>ورود و خروج پرسنل</h1>
          <p>زمان با یک لمس ثبت می‌شود و در صورت نیاز قابل اصلاح است.</p>
        </div>
        <div className="attendance-count">
          <b>{fa(inBuilding)}</b><span>نفر حاضر</span>
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
            </article>
          ))}
          {!shown.length && <div className="empty compact">پرسنلی پیدا نشد.</div>}
        </section>
      )}

      {adjusting && (
        <AdjustSheet staff={adjusting} onClose={() => setAdjusting(undefined)}
                     onSaved={() => { setAdjusting(undefined); refresh(); }} />
      )}
    </div>
  );
}

interface EntryView {
  id: number; entryAt: string; exitAt: string | null; workedMinutes: number; note: string | null;
}

function AdjustSheet({ staff, onClose, onSaved }: { staff: StaffState; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const q = useQuery({
    queryKey: ['attendance-entries', staff.userId, today],
    queryFn: (): Promise<EntryView[]> => api<any>(`/api/v1/attendance/report/${staff.userId}?from=${today}&to=${today}`)
      .then((d: any) => (d.days ?? []).flatMap((day: any) => day.shifts as EntryView[])),
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
      <p className="hint">شیفت‌های امروز. زمان‌ها را می‌توانید دقیقه‌به‌دقیقه تنظیم کنید.</p>
      {error && <div className="error">{error}</div>}
      {q.isLoading ? <Loading /> : (
        <div className="shift-edit-list">
          {q.data?.length ? q.data.map(e => (
            <ShiftRow key={e.id} entry={e}
                      onSave={(entryAt, exitAt, note) => save.mutate({ id: e.id, entryAt, exitAt, note })}
                      onDelete={() => remove.mutate(e.id)} busy={save.isPending || remove.isPending} />
          )) : <div className="empty compact">امروز شیفتی ثبت نشده است.</div>}
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

  return (
    <div className="shift-edit">
      <label>ورود<input type="datetime-local" value={entryAt} onChange={e => setEntryAt(e.target.value)} /></label>
      <label>خروج<input type="datetime-local" value={exitAt} onChange={e => setExitAt(e.target.value)} /></label>
      <label>توضیح<input value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="اختیاری" /></label>
      <div className="admin-action-row">
        <button className="primary" disabled={busy} onClick={() => onSave(entryAt, exitAt || null, note)}>ذخیره</button>
        <button className="icon-button danger-ghost" disabled={busy} onClick={onDelete} title="حذف شیفت">
          <Icon name="trash" size={16} label="حذف شیفت" />
        </button>
      </div>
    </div>
  );
}
