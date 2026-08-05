import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, fa, School } from '../lib/api';
import Loading from '../components/Loading';
import Icon from '../components/Icon';
import { toCsv, download } from '../lib/exportTable';

/*
 * Managing the school list is what keeps the manager's per-school comparison honest.
 * When school was free text, "دبیرستان فردوسی" and the same name with an Arabic yeh or a
 * double space became separate rows. The server canonicalises before comparing, so adding
 * a near-duplicate here is rejected with the existing name rather than silently accepted.
 */
export default function SchoolsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['schools-admin'], queryFn: () => api<School[]>('/api/v1/admin/schools') });
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<School>();
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: () => editing
      ? api<School>(`/api/v1/admin/schools/${editing.id}`, { method: 'PUT', body: JSON.stringify({ name, active: editing.active }) })
      : api<School>('/api/v1/admin/schools', { method: 'POST', body: JSON.stringify({ name, active: true }) }),
    onSuccess: () => { setName(''); setEditing(undefined); setError(''); qc.invalidateQueries({ queryKey: ['schools-admin'] }); qc.invalidateQueries({ queryKey: ['schools'] }); },
    onError: (e: Error) => setError(e.message),
  });

  // Deactivate rather than delete: reports already reference the name.
  const toggle = useMutation({
    mutationFn: (s: School) => s.active
      ? api<School>(`/api/v1/admin/schools/${s.id}`, { method: 'DELETE' })
      : api<School>(`/api/v1/admin/schools/${s.id}`, { method: 'PUT', body: JSON.stringify({ name: s.name, active: true }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schools-admin'] }); qc.invalidateQueries({ queryKey: ['schools'] }); },
  });

  function submit(e: FormEvent) { e.preventDefault(); if (name.trim()) save.mutate(); }

  function exportCsv() {
    const rows = (q.data ?? []).map(s => ({ 'مدرسه': s.name, 'وضعیت': s.active ? 'فعال' : 'غیرفعال' }));
    download('schools.csv', toCsv(rows));
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">مدیریت سامانه</span>
          <h1>فهرست مدارس</h1>
          <p>نام مدارس یک‌بار ثبت می‌شود تا در گزارش‌ها یکسان بماند.</p>
        </div>
        <div className="head-actions">
          <button className="secondary" onClick={exportCsv} disabled={!q.data?.length}>
            <Icon name="download" size={16} /><span>CSV</span>
          </button>
        </div>
      </header>

      <form className="form-card school-form" onSubmit={submit}>
        <label>{editing ? 'ویرایش نام مدرسه' : 'افزودن مدرسه جدید'}
          <input value={name} maxLength={160} placeholder="مثلاً دبیرستان فردوسی"
                 onChange={e => { setName(e.target.value); setError(''); }} />
        </label>
        <div className="admin-action-row">
          <button className="primary" disabled={!name.trim() || save.isPending}>
            {save.isPending ? 'در حال ذخیره…' : editing ? 'ذخیره' : 'افزودن'}
          </button>
          {editing && (
            <button type="button" className="secondary"
                    onClick={() => { setEditing(undefined); setName(''); setError(''); }}>
              انصراف
            </button>
          )}
        </div>
        {error && <div className="error">{error}</div>}
      </form>

      {q.isLoading ? <Loading /> : (
        <section className="table-card">
          <div className="section-title">
            <b>مدارس ثبت‌شده</b><span>{fa(q.data?.length || 0)} مدرسه</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>نام مدرسه</th><th>وضعیت</th><th>عملیات</th></tr></thead>
              <tbody>
                {q.data?.length ? q.data.map(s => (
                  <tr key={s.id} className={s.active ? '' : 'inactive-row'}>
                    <td><b>{s.name}</b></td>
                    <td>{s.active ? 'فعال' : 'غیرفعال'}</td>
                    <td>
                      <div className="admin-action-row">
                        <button className="ghost" onClick={() => { setEditing(s); setName(s.name); }}>ویرایش</button>
                        <button className="ghost" onClick={() => toggle.mutate(s)}>
                          {s.active ? 'غیرفعال کردن' : 'فعال کردن'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={3} className="empty-cell">هنوز مدرسه‌ای ثبت نشده است.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
