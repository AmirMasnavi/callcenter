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
  ADMIN: 'مدیریت کاربران و اختیارات کامل گزارش‌ها',
};
const ALL_ROLES = Object.keys(ROLE_HELP) as Role[];

const emptyForm = {
  username: '', displayName: '', roles: ['AGENT'] as Role[],
  grantedPermissions: [] as Permission[], revokedPermissions: [] as Permission[],
  supervisorId: '', active: true, temporaryPassword: '',
};

/** What the chosen roles grant on their own — mirrors Permission.defaultsFor on the server. */
const ROLE_DEFAULTS: Record<Role, Permission[]> = {
  AGENT: ['SUBMIT_REPORTS'],
  SUPERVISOR: ['REVIEW_REPORTS'],
  MANAGER: ['VIEW_DASHBOARD', 'EXPORT_DATA', 'VIEW_ALL_REPORTS', 'MANAGE_SCHOOLS'],
  ADMIN: Object.keys(permissionLabel) as Permission[],
};
const defaultsFor = (roles: Role[]) =>
  new Set(roles.flatMap(r => ROLE_DEFAULTS[r]));

const ALL_PERMISSIONS = Object.keys(permissionLabel) as Permission[];

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
      grantedPermissions: u.grantedPermissions ?? [], revokedPermissions: u.revokedPermissions ?? [],
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

  /**
   * One checkbox per capability, but the meaning depends on whether the roles already
   * grant it: ticking something a role doesn't give is a GRANT, unticking something a
   * role does give is a REVOKE. Anything matching the role default is stored as neither,
   * so changing roles later still behaves predictably.
   */
  function togglePermission(permission: Permission) {
    setForm(f => {
      const fromRoles = defaultsFor(f.roles).has(permission);
      const currentlyOn = fromRoles
        ? !f.revokedPermissions.includes(permission)
        : f.grantedPermissions.includes(permission);
      const turningOn = !currentlyOn;
      return {
        ...f,
        grantedPermissions: !fromRoles && turningOn
          ? [...f.grantedPermissions, permission]
          : f.grantedPermissions.filter(p => p !== permission),
        revokedPermissions: fromRoles && !turningOn
          ? [...f.revokedPermissions, permission]
          : f.revokedPermissions.filter(p => p !== permission),
      };
    });
  }

  const supervisors = q.data?.filter(u => u.roles.includes('SUPERVISOR')) ?? [];

  // Exports the list as shown, so what you download matches what you were looking at.
  function exportCurrent() {
    if (auditMode) {
      download('audit-log.csv', toCsv((audit.data ?? []).map((a: any) => ({
        'کاربر': a.actor, 'عملیات': a.action,
        'موجودیت': `${a.entityType} #${a.entityId ?? ''}`,
        'زمان': new Date(a.createdAt).toLocaleString('fa-IR'),
      }))));
    } else {
      download('users.csv', toCsv((q.data ?? []).map(u => ({
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
          <button className="secondary" onClick={() => setAuditMode(!auditMode)}>
            {auditMode ? 'کاربران' : 'تاریخچه فعالیت'}
          </button>
          <button className="secondary" onClick={exportCurrent}
                  disabled={auditMode ? !audit.data?.length : !q.data?.length}>
            <Icon name="download" size={16} /><span>CSV</span>
          </button>
          {!auditMode && <button className="primary" onClick={newUser}>+ کاربر جدید</button>}
        </div>
      </header>

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
          {q.data?.map(u => (
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
                <button className="ghost view-as" disabled={!u.active || impersonate.isPending}
                        onClick={() => impersonate.mutate(u.id)}
                        title={`مشاهده سامانه به‌جای ${u.displayName}`}>
                  مشاهده به‌جای این کاربر
                </button>
              )}
            </article>
          ))}
        </section>
      )}

      {open && (
        <UserSheet
          editing={!!editing} form={form} setForm={setForm} toggleRole={toggleRole}
          togglePermission={togglePermission}
          supervisors={supervisors} setAvatar={setAvatar}
          error={save.error?.message} busy={save.isPending}
          onClose={() => setOpen(false)}
          onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}
        />
      )}
    </div>
  );
}

/**
 * Capabilities, shown as one list with the source made explicit: inherited from a role,
 * added on top, or withheld. Without that labelling an admin cannot tell why a box is
 * ticked, and unticking a role-granted item looks like a bug rather than an exception.
 */
function PermissionPicker({ form, toggle }: { form: typeof emptyForm; toggle: (p: Permission) => void }) {
  const fromRoles = defaultsFor(form.roles);
  return (
    <fieldset className="role-picker-wrap">
      <legend>دسترسی‌ها</legend>
      <p className="hint">
        نقش‌ها به‌طور پیش‌فرض دسترسی‌های زیر را می‌دهند. می‌توانید مورد به مورد اضافه یا کم کنید.
      </p>
      <div className="permission-list">
        {ALL_PERMISSIONS.map(p => {
          const inherited = fromRoles.has(p);
          const revoked = form.revokedPermissions.includes(p);
          const granted = form.grantedPermissions.includes(p);
          const on = inherited ? !revoked : granted;
          return (
            <label key={p} className={'permission-row' + (on ? ' on' : '') + (revoked ? ' revoked' : '')}>
              <input type="checkbox" checked={on} onChange={() => toggle(p)} />
              <span className="permission-name">{permissionLabel[p]}</span>
              {inherited && !revoked && <span className="perm-tag inherited">از نقش</span>}
              {granted && <span className="perm-tag added">افزوده</span>}
              {revoked && <span className="perm-tag removed">حذف‌شده</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

interface SheetProps {
  editing: boolean;
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
  toggleRole: (r: Role) => void;
  togglePermission: (p: Permission) => void;
  supervisors: User[];
  setAvatar: (f?: File) => void;
  error?: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}

function UserSheet({ editing, form, setForm, toggleRole, togglePermission, supervisors, setAvatar, error, busy, onClose, onSubmit }: SheetProps) {
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
          <legend>نقش‌ها (می‌توانید چند نقش انتخاب کنید)</legend>
          <div className="role-picker">
            {ALL_ROLES.map(r => (
              <label key={r} className={'role-option' + (form.roles.includes(r) ? ' checked' : '')}>
                <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r)} />
                <span><b>{roleLabel[r]}</b><span>{ROLE_HELP[r]}</span></span>
              </label>
            ))}
          </div>
          {!form.roles.length && <small className="field-error">حداقل یک نقش لازم است.</small>}
        </fieldset>

        <PermissionPicker form={form} toggle={togglePermission} />

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
