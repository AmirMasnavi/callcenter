import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUrl, fa, Me, MIN_PASSWORD_LENGTH, Permission, permissionLabel, Role, roleLabel } from '../lib/api';
import Loading from '../components/Loading';
import Sheet from '../components/Sheet';
import Icon from '../components/Icon';
import { toCsv, download } from '../lib/exportTable';

type User = {
  id: number; username: string; displayName: string; roles: Role[];
  effectivePermissions: Permission[]; rolePermissions: Permission[];
  grantedPermissions: Permission[]; revokedPermissions: Permission[];
  supervisorId?: number; supervisorName?: string;
  active: boolean; mustChangePassword: boolean; hasAvatar: boolean;
};

const ROLE_HELP: Record<Role, string> = {
  AGENT: 'ثبت و ارسال گزارش روزانه',
  SUPERVISOR: 'بررسی و تأیید گزارش‌های تیم خود',
  MANAGER: 'داشبورد تحلیلی و خروجی‌ها',
  OFFICE_MANAGER: 'ثبت ورود و خروج پرسنل',
  PAYROLL: 'گزارش ساعات کاری و محاسبه حقوق',
  ADMIN: 'مدیریت کاربران و اختیارات کامل گزارش‌ها',
};
const ALL_ROLES = Object.keys(ROLE_HELP) as Role[];

const emptyForm = {
  username: '', displayName: '', roles: ['AGENT'] as Role[],
  supervisorId: '', active: true, temporaryPassword: '',
};


export default function AdminPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['users'], queryFn: () => api<User[]>('/api/v1/admin/users') });
  const [auditMode, setAuditMode] = useState(false);
  const audit = useQuery({
    queryKey: ['audit'], queryFn: () => api<any[]>('/api/v1/admin/audit'), enabled: auditMode,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number>();
  const [avatar, setAvatar] = useState<File>();
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      const user = await api<User>(
        editing ? `/api/v1/admin/users/${editing}` : '/api/v1/admin/users',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...form,
            supervisorId: form.supervisorId ? Number(form.supervisorId) : null,
            temporaryPassword: form.temporaryPassword || null,
          }),
        });
      if (avatar) {
        const data = new FormData();
        data.append('file', avatar);
        return api<User>(`/api/v1/admin/users/${user.id}/avatar`, { method: 'POST', body: data });
      }
      return user;
    },
    onSuccess: () => {
      setOpen(false); setEditing(undefined); setAvatar(undefined);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // Impersonation swaps the whole session, so every cached query has to go.
  const impersonate = useMutation({
    mutationFn: (id: number) => api<Me>(`/api/v1/admin/impersonate/${id}`, { method: 'POST' }),
    onSuccess: () => {
      history.replaceState({}, '', '/app/report');
      location.reload();
    },
  });

  function newUser() {
    setEditing(undefined); setAvatar(undefined); setForm(emptyForm); save.reset(); setOpen(true);
  }
  function edit(u: User) {
    setEditing(u.id); setAvatar(undefined); save.reset();
    setForm({
      username: u.username, displayName: u.displayName, roles: u.roles,
      supervisorId: u.supervisorId ? String(u.supervisorId) : '',
      active: u.active, temporaryPassword: '',
    });
    setOpen(true);
  }
  function toggleRole(role: Role) {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }));
  }

  const supervisors = q.data?.filter(u => u.roles.includes('SUPERVISOR')) ?? [];
  // Searches name, username and role label, so "ناظر" finds every supervisor.
  const shownUsers = (q.data ?? []).filter(u => {
    const term = query.trim();
    if (!term) return true;
    return `${u.displayName} ${u.username} ${u.roles.map(r => roleLabel[r]).join(' ')}`.includes(term);
  });

  // Exports the list as shown, so what you download matches what you were looking at.
  function exportCurrent() {
    if (auditMode) {
      download('audit-log.csv', toCsv((audit.data ?? []).map((a: any) => ({
        'کاربر': a.actor, 'عملیات': a.action,
        'موجودیت': `${a.entityType} #${a.entityId ?? ''}`,
        'زمان': new Date(a.createdAt).toLocaleString('fa-IR'),
      }))));
    } else {
      download('users.csv', toCsv(shownUsers.map(u => ({
        'نام': u.displayName, 'نام کاربری': u.username,
        'نقش‌ها': u.roles.map(r => roleLabel[r]).join(' / '),
        'ناظر': u.supervisorName ?? '', 'وضعیت': u.active ? 'فعال' : 'غیرفعال',
        'دسترسی‌ها': (u.effectivePermissions ?? []).map(p => permissionLabel[p]).join(' / '),
      }))));
    }
  }
  const meId = qc.getQueryData<Me>(['me'])?.id;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">مدیریت سامانه</span>
          <h1>{auditMode ? 'تاریخچه فعالیت‌ها' : 'کاربران و دسترسی‌ها'}</h1>
          <p>حساب‌های سازمانی، نقش‌ها و ارتباط اپراتورها با ناظران.</p>
        </div>
        <div className="head-actions">
          <button className="icon-button" onClick={() => setAuditMode(!auditMode)}
                  title={auditMode ? 'بازگشت به کاربران' : 'تاریخچه فعالیت'}>
            <Icon name={auditMode ? 'users' : 'eye'} label={auditMode ? 'بازگشت به کاربران' : 'تاریخچه فعالیت'} />
          </button>
          <button className="icon-button" onClick={exportCurrent} title="خروجی CSV"
                  disabled={auditMode ? !audit.data?.length : !q.data?.length}>
            <Icon name="download" label="خروجی CSV" />
          </button>
          {!auditMode && (
            <button className="primary" onClick={newUser}>
              <Icon name="plus" size={18} /><span>کاربر جدید</span>
            </button>
          )}
        </div>
      </header>

      {!auditMode && (
        <div className="search-field">
          <Icon name="search" size={18} />
          <input value={query} onChange={e => setQuery(e.target.value)}
                 placeholder="جست‌وجوی نام، نام کاربری یا نقش…" aria-label="جست‌وجوی کاربر" />
          {query && (
            <button className="icon-button ghost-clear" onClick={() => setQuery('')} title="پاک کردن">
              <Icon name="close" size={16} label="پاک کردن جست‌وجو" />
            </button>
          )}
        </div>
      )}

      {auditMode ? (
        audit.isLoading ? <Loading /> : (
          <section className="table-card">
            <table>
              <thead><tr><th>کاربر</th><th>عملیات</th><th>موجودیت</th><th>زمان</th></tr></thead>
              <tbody>
                {audit.data?.map(a => (
                  <tr key={a.id}>
                    <td>{a.actor}</td><td>{a.action}</td>
                    <td>{a.entityType} #{a.entityId}</td>
                    <td>{new Date(a.createdAt).toLocaleString('fa-IR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      ) : q.isLoading ? <Loading /> : (
        <section className="user-grid">
          {shownUsers.map(u => (
            <article key={u.id}>
              <button className="user-card-main" onClick={() => edit(u)}
                      aria-label={`ویرایش حساب ${u.displayName}`}>
                <div className="avatar large">
                  {u.displayName.slice(0, 1)}
                  {u.hasAvatar && <img src={apiUrl(`/api/v1/users/${u.id}/avatar`)} alt="" />}
                </div>
                <div><b>{u.displayName}</b><span>@{u.username}</span></div>
                <div className="role-chips">
                  {u.roles.map(r => <span key={r} className={'role-chip ' + r}>{roleLabel[r]}</span>)}
                </div>
                <small>
                  {u.roles.includes('AGENT') ? `ناظر: ${u.supervisorName || 'تعیین نشده'}` : ''}
                  {!u.active && ' · غیرفعال'}
                </small>
              </button>
              {/* Viewing as yourself is meaningless, so it isn't offered. */}
              {u.id !== meId && (
                <button className="icon-button view-as" disabled={!u.active || impersonate.isPending}
                        onClick={() => impersonate.mutate(u.id)}
                        title={`مشاهده سامانه به‌جای ${u.displayName}`}>
                  <Icon name="eye" size={16} label={`مشاهده به‌جای ${u.displayName}`} />
                </button>
              )}
            </article>
          ))}
        </section>
      )}

      {open && (
        <UserSheet
          editing={!!editing} form={form} setForm={setForm} toggleRole={toggleRole}
          supervisors={supervisors} setAvatar={setAvatar}
          error={save.error?.message} busy={save.isPending}
          onClose={() => setOpen(false)}
          onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}
        />
      )}
    </div>
  );
}

interface SheetProps {
  editing: boolean;
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
  toggleRole: (r: Role) => void;
  supervisors: User[];
  setAvatar: (f?: File) => void;
  error?: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}

function UserSheet({ editing, form, setForm, toggleRole, supervisors, setAvatar, error, busy, onClose, onSubmit }: SheetProps) {
  return (
    <Sheet onClose={onClose} labelledBy="user-sheet-title">
      <form onSubmit={onSubmit}>
        <h2 id="user-sheet-title">{editing ? 'ویرایش حساب' : 'ساخت حساب جدید'}</h2>

        <label>نام و نام خانوادگی
          <input required value={form.displayName}
                 onChange={e => setForm({ ...form, displayName: e.target.value })} />
        </label>
        <label>عکس پرسنلی (حداکثر ۲ مگابایت)
          <input type="file" accept="image/*" onChange={e => setAvatar(e.target.files?.[0])} />
        </label>
        <label>نام کاربری
          <input required value={form.username}
                 onChange={e => setForm({ ...form, username: e.target.value })} />
        </label>

        {/* Roles are not exclusive, so this is a checklist, not a dropdown. */}
        <fieldset className="role-picker-wrap">
          <legend>نقش‌ها</legend>
          <div className="role-rows">
            {ALL_ROLES.map(r => {
              const on = form.roles.includes(r);
              return (
                <label key={r} className={'role-row' + (on ? ' on' : '')}>
                  <input type="checkbox" checked={on} onChange={() => toggleRole(r)} />
                  <span className="role-row-text">
                    <b>{roleLabel[r]}</b>
                    <small>{ROLE_HELP[r]}</small>
                  </span>
                </label>
              );
            })}
          </div>
          {!form.roles.length && <small className="field-error">حداقل یک نقش لازم است.</small>}
        </fieldset>

        {/* A supervisor only means something for someone who files reports. */}
        {form.roles.includes('AGENT') && (
          <label>ناظر
            <select value={form.supervisorId}
                    onChange={e => setForm({ ...form, supervisorId: e.target.value })}>
              <option value="">بدون ناظر</option>
              {supervisors.map(u => <option value={u.id} key={u.id}>{u.displayName}</option>)}
            </select>
          </label>
        )}

        <label>رمز موقت {editing && '(برای حفظ رمز فعلی خالی بگذارید)'}
          <input type="password" minLength={MIN_PASSWORD_LENGTH} required={!editing}
                 value={form.temporaryPassword}
                 onChange={e => setForm({ ...form, temporaryPassword: e.target.value })} />
        </label>
        <small className="hint">حداقل {fa(MIN_PASSWORD_LENGTH)} نویسه. کاربر پس از ورود می‌تواند آن را تغییر دهد.</small>

        <label className="toggle">
          <input type="checkbox" checked={form.active}
                 onChange={e => setForm({ ...form, active: e.target.checked })} /> حساب فعال باشد
        </label>

        {error && <div className="error">{error}</div>}
        <button className="primary wide" disabled={busy || !form.roles.length}>
          {busy ? 'در حال ذخیره…' : editing ? 'ذخیره تغییرات' : 'ساخت حساب'}
        </button>
      </form>
    </Sheet>
  );
}
