import { FormEvent, ReactNode, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiUrl, fa, Me, MIN_PASSWORD_LENGTH, roleLabel } from '../lib/api';
import { readChoice, setTheme, ThemeChoice } from '../lib/theme';
import Icon from '../components/Icon';

const THEMES = [
  { value: 'light' as ThemeChoice, label: 'روشن', icon: 'sun' as const },
  { value: 'dark' as ThemeChoice, label: 'تیره', icon: 'moon' as const },
  { value: 'system' as ThemeChoice, label: 'مطابق سیستم', icon: 'auto' as const },
];

type Section = null | 'appearance' | 'password';

/*
 * Account settings as a grouped list you step into, rather than every control stacked on
 * one screen. Appearance and password are changed rarely; showing all of it at once made
 * the page look busy and buried whatever you actually came for.
 */
export default function Profile({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [section, setSection] = useState<Section>(null);
  const [theme, setThemeChoice] = useState<ThemeChoice>(readChoice);
  const current = THEMES.find(t => t.value === theme);

  if (section === 'appearance') {
    return (
      <SubView title="ظاهر برنامه" onBack={() => setSection(null)}>
        <p className="hint">حالت پیش‌فرض روشن است. اگر ترجیح می‌دهید، می‌توانید تغییر دهید.</p>
        <div className="more-list">
          {THEMES.map(t => (
            <button key={t.value} onClick={() => { setTheme(t.value); setThemeChoice(t.value); }}>
              <Icon name={t.icon} />
              <span>{t.label}</span>
              {theme === t.value && <Icon name="check" size={18} />}
            </button>
          ))}
        </div>
      </SubView>
    );
  }

  if (section === 'password') {
    return (
      <SubView title="تغییر رمز عبور" onBack={() => setSection(null)}>
        <PasswordForm me={me} />
      </SubView>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">حساب کاربری</span>
          <h1>حساب من</h1>
        </div>
      </header>

      <IdentityCard me={me} />

      <div className="more-list settings-list">
        <button onClick={() => setSection('appearance')}>
          <Icon name={current?.icon ?? 'sun'} />
          <span>ظاهر برنامه</span>
          <em className="row-value">{current?.label}</em>
          <i aria-hidden="true">‹</i>
        </button>
        <button onClick={() => setSection('password')}>
          <Icon name="key" />
          <span>تغییر رمز عبور</span>
          {me.mustChangePassword && <em className="row-value warn">موقت</em>}
          <i aria-hidden="true">‹</i>
        </button>
      </div>

      <div className="more-list settings-list">
        <button className="danger-row" onClick={onLogout}>
          <Icon name="logout" />
          <span>خروج از حساب</span>
        </button>
      </div>
    </div>
  );
}

function SubView({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="page">
      <header className="page-head sub-head">
        <button className="back-to-queue" onClick={onBack}>
          <Icon name="back" size={18} /><span>حساب من</span>
        </button>
        <h1>{title}</h1>
      </header>
      <section className="profile-card">{children}</section>
    </div>
  );
}

function IdentityCard({ me }: { me: Me }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  // The avatar URL is stable, so without this the browser keeps serving the old image.
  const [version, setVersion] = useState(0);

  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) { setError('حجم عکس باید کمتر از ۲ مگابایت باشد'); return; }
    setUploading(true); setError('');
    try {
      const data = new FormData();
      data.append('file', file);
      await api('/api/v1/users/me/avatar', { method: 'POST', body: data });
      setVersion(v => v + 1);
    } catch (e) { setError((e as Error).message); } finally { setUploading(false); }
  }

  async function remove() {
    setUploading(true); setError('');
    try {
      await api('/api/v1/users/me/avatar', { method: 'DELETE' });
      setVersion(v => v + 1);
    } catch (e) { setError((e as Error).message); } finally { setUploading(false); }
  }

  return (
    <section className="identity-card">
      <div className="avatar large">
        {me.displayName.slice(0, 1)}
        <img src={apiUrl(`/api/v1/users/${me.id}/avatar`) + `?v=${version}`} alt=""
             onError={e => (e.currentTarget.style.display = 'none')} />
      </div>
      <div className="identity-text">
        <b>{me.displayName}</b>
        <span>@{me.username}</span>
        <div className="role-chips">
          {me.roles.map(r => <span key={r} className={'role-chip ' + r}>{roleLabel[r]}</span>)}
        </div>
      </div>
      <div className="avatar-actions">
        <label className="as-button">
          {uploading ? '…' : 'انتخاب عکس'}
          <input type="file" accept="image/*" hidden disabled={uploading}
                 onChange={e => upload(e.target.files?.[0])} />
        </label>
        <button type="button" className="icon-button danger-ghost" disabled={uploading}
                onClick={remove} title="حذف عکس">
          <Icon name="trash" size={16} label="حذف عکس" />
        </button>
      </div>
      {error && <div className="error">{error}</div>}
    </section>
  );
}

function PasswordForm({ me }: { me: Me }) {
  const qc = useQueryClient();
  // Snapshotted at mount: reading it live would flip the form the instant a change
  // succeeded, leaving the success banner above a now-required current-password field.
  const [forced] = useState(() => me.mustChangePassword);
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const tooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== newPassword;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mismatch) { setError('تکرار رمز با رمز جدید یکسان نیست'); return; }
    setBusy(true); setError(''); setDone(false);
    try {
      await api('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: forced ? null : currentPassword, newPassword }),
      });
      setDone(true);
      setCurrent(''); setNext(''); setConfirm('');
      qc.setQueryData(['me'], { ...me, mustChangePassword: false });
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      <p className="hint">
        {forced
          ? 'رمز فعلی شما موقت است. کافی است رمز تازه را دو بار وارد کنید.'
          : 'برای تغییر رمز، ابتدا رمز فعلی خود را وارد کنید.'}
      </p>

      {!forced && (
        <label>رمز فعلی
          <input type="password" autoComplete="current-password" required
                 value={currentPassword} onChange={e => setCurrent(e.target.value)} />
        </label>
      )}

      <label>رمز جدید
        <input type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH}
               aria-describedby="pw-rule" value={newPassword} onChange={e => setNext(e.target.value)} />
      </label>
      <small id="pw-rule" className={tooShort ? 'field-error' : 'hint'}>
        حداقل {fa(MIN_PASSWORD_LENGTH)} نویسه.
      </small>

      <label>تکرار رمز جدید
        <input type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH}
               value={confirm} onChange={e => setConfirm(e.target.value)} />
      </label>
      {mismatch && <small className="field-error">تکرار رمز یکسان نیست.</small>}

      {error && <div className="error">{error}</div>}
      {done && <div className="success" role="status">رمز عبور با موفقیت تغییر کرد.</div>}

      <button className="primary wide" disabled={busy || tooShort || mismatch}>
        {busy ? 'در حال ثبت…' : 'ثبت رمز جدید'}
      </button>
    </form>
  );
}
