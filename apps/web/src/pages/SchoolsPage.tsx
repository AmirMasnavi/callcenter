import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, fa, School } from '../lib/api';
import Loading from '../components/Loading';
import Icon from '../components/Icon';
import Sheet from '../components/Sheet';
import { toCsv, download } from '../lib/exportTable';

/*
 * Managing the school list keeps the manager's per-school comparison honest — as free
 * text, one school could appear several times (Arabic yeh, a doubled space). The server
 * canonicalises before comparing, so a near-duplicate is rejected with the existing name.
 *
 * Editing happens in place: a row's edit icon opens a sheet for THAT school. Previously it
 * pushed the name back into the "add" form at the top of the page, which meant scrolling
 * away from the row you were working on and made it unclear whether you were adding or
 * renaming.
 */
export default function SchoolsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['schools-admin'], queryFn: () => api<School[]>('/api/v1/admin/schools') });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<School>();
  const [query, setQuery] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['schools-admin'] });
    qc.invalidateQueries({ queryKey: ['schools'] });
  };

  const toggle = useMutation({
    mutationFn: (s: School) => s.active
      ? api<School>(`/api/v1/admin/schools/${s.id}`, { method: 'DELETE' })
      : api<School>(`/api/v1/admin/schools/${s.id}`, { method: 'PUT', body: JSON.stringify({ name: s.name, active: true }) }),
    onSuccess: refresh,
  });

  const shown = (q.data ?? []).filter(s => !query.trim() || s.name.includes(query.trim()));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">مدیریت سامانه</span>
          <h1>فهرست مدارس</h1>
          <p>نام مدارس یک‌بار ثبت می‌شود تا در گزارش‌ها یکسان بماند.</p>
        </div>
        <div className="head-actions">
          <button className="icon-button" title="خروجی CSV" disabled={!shown.length}
                  onClick={() => download('schools.csv', toCsv(shown.map(s => ({
                    'مدرسه': s.name, 'وضعیت': s.active ? 'فعال' : 'غیرفعال',
                  }))))}>
            <Icon name="download" label="خروجی CSV" />
          </button>
          <button className="primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} /><span>مدرسه جدید</span>
          </button>
        </div>
      </header>

      <div className="search-field">
        <Icon name="search" size={18} />
        <input value={query} onChange={e => setQuery(e.target.value)}
               placeholder="جست‌وجوی مدرسه…" aria-label="جست‌وجوی مدرسه" />
        {query && (
          <button className="icon-button ghost-clear" onClick={() => setQuery('')} title="پاک کردن">
            <Icon name="close" size={16} label="پاک کردن جست‌وجو" />
          </button>
        )}
      </div>

      {q.isLoading ? <Loading /> : (
        <section className="school-list">
          {shown.length ? shown.map(s => (
            <article key={s.id} className={s.active ? '' : 'inactive-row'}>
              <div className="school-name">
                <b>{s.name}</b>
                {!s.active && <span className="perm-tag removed">غیرفعال</span>}
              </div>
              <div className="row-actions">
                <button className="icon-button" title="ویرایش نام" onClick={() => setEditing(s)}>
                  <Icon name="edit" size={16} label={`ویرایش ${s.name}`} />
                </button>
                <button className="icon-button" title={s.active ? 'غیرفعال کردن' : 'فعال کردن'}
                        onClick={() => toggle.mutate(s)}>
                  <Icon name={s.active ? 'trash' : 'refresh'} size={16}
                        label={`${s.active ? 'غیرفعال کردن' : 'فعال کردن'} ${s.name}`} />
                </button>
              </div>
            </article>
          )) : (
            <div className="empty compact">
              {query ? 'مدرسه‌ای با این نام پیدا نشد.' : 'هنوز مدرسه‌ای ثبت نشده است.'}
            </div>
          )}
        </section>
      )}

      {(adding || editing) && (
        <SchoolSheet school={editing} onClose={() => { setAdding(false); setEditing(undefined); }}
                     onSaved={() => { setAdding(false); setEditing(undefined); refresh(); }} />
      )}
    </div>
  );
}

function SchoolSheet({ school, onClose, onSaved }: { school?: School; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(school?.name ?? '');
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: () => school
      ? api<School>(`/api/v1/admin/schools/${school.id}`, { method: 'PUT', body: JSON.stringify({ name, active: school.active }) })
      : api<School>('/api/v1/admin/schools', { method: 'POST', body: JSON.stringify({ name, active: true }) }),
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) { setError(''); save.mutate(); }
  }

  return (
    <Sheet onClose={onClose} labelledBy="school-sheet-title">
      <form onSubmit={submit}>
        <h2 id="school-sheet-title">{school ? 'ویرایش مدرسه' : 'مدرسه جدید'}</h2>
        <label>نام مدرسه
          <input autoFocus value={name} maxLength={160} placeholder="مثلاً دبیرستان فردوسی"
                 onChange={e => { setName(e.target.value); setError(''); }} />
        </label>
        <small className="hint">اگر مدرسه‌ای با همین نام وجود داشته باشد، دوباره ثبت نمی‌شود.</small>
        {error && <div className="error">{error}</div>}
        <button className="primary wide" disabled={!name.trim() || save.isPending}>
          {save.isPending ? 'در حال ذخیره…' : school ? 'ذخیره تغییرات' : 'افزودن مدرسه'}
        </button>
      </form>
    </Sheet>
  );
}
