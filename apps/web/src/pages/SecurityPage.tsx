import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, fa } from '../lib/api';
import Loading from '../components/Loading';

interface Security { loginGuardEnabled: boolean; maxAttempts: number; lockoutMinutes: number; currentlyLocked: number }

/*
 * The login throttle is useful right up until it locks the admin out of their own system,
 * at which point there is no way back in without database access. These controls exist so
 * that is recoverable: relax the thresholds, clear a specific lock, or switch it off.
 */
export default function SecurityPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['security'], queryFn: () => api<Security>('/api/v1/admin/settings/security') });
  const [form, setForm] = useState<Security>();
  const [unlockUser, setUnlockUser] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  const save = useMutation({
    mutationFn: () => api<Security>('/api/v1/admin/settings/security', {
      method: 'PUT',
      body: JSON.stringify({
        loginGuardEnabled: form!.loginGuardEnabled,
        maxAttempts: form!.maxAttempts,
        lockoutMinutes: form!.lockoutMinutes,
      }),
    }),
    onSuccess: s => { qc.setQueryData(['security'], s); setNotice('تنظیمات ذخیره شد.'); },
  });

  const unlock = useMutation({
    mutationFn: () => api<{ cleared: number }>(
      `/api/v1/admin/settings/security/unlock${unlockUser.trim() ? `?username=${encodeURIComponent(unlockUser.trim())}` : ''}`,
      { method: 'POST' }),
    onSuccess: r => {
      setNotice(r.cleared ? `${fa(r.cleared)} قفل ورود آزاد شد.` : 'قفل فعالی وجود نداشت.');
      setUnlockUser('');
      qc.invalidateQueries({ queryKey: ['security'] });
    },
  });

  if (q.isLoading || !form) return <Loading />;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">مدیریت سامانه</span>
          <h1>امنیت ورود</h1>
          <p>محدودیت تلاش‌های ناموفق ورود و آزادسازی حساب‌های قفل‌شده.</p>
        </div>
      </header>

      {notice && <div className="success" role="status">{notice}</div>}

      <section className="profile-grid">
        <div className="profile-card">
          <h2>محدودیت تلاش ورود</h2>
          <p className="hint">
            پس از چند تلاش ناموفق، ورود برای مدتی قفل می‌شود. اگر این محدودیت باعث مشکل شده،
            می‌توانید آن را غیرفعال کنید.
          </p>

          <label className="toggle">
            <input type="checkbox" checked={form.loginGuardEnabled}
                   onChange={e => setForm({ ...form, loginGuardEnabled: e.target.checked })} />
            محدودیت تلاش ورود فعال باشد
          </label>

          <label>حداکثر تلاش ناموفق
            <input type="number" min={1} max={50} disabled={!form.loginGuardEnabled}
                   value={form.maxAttempts}
                   onChange={e => setForm({ ...form, maxAttempts: Number(e.target.value) || 1 })} />
          </label>

          <label>مدت قفل (دقیقه)
            <input type="number" min={1} max={1440} disabled={!form.loginGuardEnabled}
                   value={form.lockoutMinutes}
                   onChange={e => setForm({ ...form, lockoutMinutes: Number(e.target.value) || 1 })} />
          </label>

          {save.error && <div className="error">{(save.error as Error).message}</div>}
          <button className="primary wide" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}
          </button>
        </div>

        <div className="profile-card">
          <h2>آزادسازی حساب قفل‌شده</h2>
          <p className="hint">
            هم‌اکنون {form.currentlyLocked ? <b>{fa(form.currentlyLocked)}</b> : 'هیچ'} حساب قفل‌شده وجود دارد.
            برای آزادسازی همه، فیلد را خالی بگذارید.
          </p>
          <label>نام کاربری (اختیاری)
            <input value={unlockUser} onChange={e => setUnlockUser(e.target.value)} placeholder="مثلاً admin" />
          </label>
          {unlock.error && <div className="error">{(unlock.error as Error).message}</div>}
          <button className="secondary wide" disabled={unlock.isPending} onClick={() => unlock.mutate()}>
            {unlock.isPending ? 'در حال آزادسازی…' : 'آزادسازی قفل ورود'}
          </button>
        </div>
      </section>
    </div>
  );
}
