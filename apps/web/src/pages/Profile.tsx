import { FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiUrl, fa, Me, MIN_PASSWORD_LENGTH, roleLabel } from '../lib/api';
import { readChoice, setTheme, ThemeChoice } from '../lib/theme';

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'روشن' },
  { value: 'dark', label: 'تیره' },
  { value: 'system', label: 'مطابق سیستم' },
];

/*
 * Replaces the old blocking "change your password" wall.
 *
 * While the account still carries a temporary password the current-password field is
 * hidden entirely: the user proved it seconds ago at login, and asking again is friction
 * with no security value. A voluntary change still asks for it.
 */
export default function Profile({ me }: { me: Me }) {
  const qc = useQueryClient();
  const forced = me.mustChangePassword;
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [theme, setThemeChoice] = useState<ThemeChoice>(readChoice);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  // Bumped after a change so the <img> refetches — the avatar URL is otherwise stable
  // and the browser would keep serving the old picture from cache.
  const [avatarVersion, setAvatarVersion] = useState(0);

  function chooseTheme(choice: ThemeChoice) {
    setTheme(choice);
    setThemeChoice(choice);
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) { setAvatarError('حجم عکس باید کمتر از ۲ مگابایت باشد'); return; }
    setUploading(true); setAvatarError('');
    try {
      const data = new FormData();
      data.append('file', file);
      await api('/api/v1/users/me/avatar', { method: 'POST', body: data });
      setAvatarVersion(v => v + 1);
    } catch (err) {
      setAvatarError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setUploading(true); setAvatarError('');
    try {
      await api('/api/v1/users/me/avatar', { method: 'DELETE' });
      setAvatarVersion(v => v + 1);
    } catch (err) {
      setAvatarError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">حساب کاربری</span>
          <h1>حساب من</h1>
          <p>اطلاعات حساب و تغییر رمز عبور.</p>
        </div>
      </header>

      <section className="profile-grid">
        <article className="profile-card">
          <div className="avatar large">
            {me.displayName.slice(0, 1)}
            <img src={apiUrl(`/api/v1/users/${me.id}/avatar`) + `?v=${avatarVersion}`} alt=""
                 onError={e => (e.currentTarget.style.display = 'none')} />
          </div>
          <div>
            <b>{me.displayName}</b>
            <span>@{me.username}</span>
          </div>
          <div className="role-chips">
            {me.roles.map(r => <span key={r} className={'role-chip ' + r}>{roleLabel[r]}</span>)}
          </div>
          {me.roles.length > 1 && (
            <small>این حساب چند نقش دارد؛ همه بخش‌های مربوط در منو در دسترس است.</small>
          )}

          {/* Everyone sets their own picture — it no longer needs an admin. */}
          <div className="avatar-actions">
            <label className="secondary as-button">
              {uploading ? 'در حال بارگذاری…' : 'انتخاب عکس'}
              <input type="file" accept="image/*" hidden disabled={uploading}
                     onChange={e => uploadAvatar(e.target.files?.[0])} />
            </label>
            <button type="button" className="ghost" disabled={uploading} onClick={removeAvatar}>
              حذف عکس
            </button>
          </div>
          <small className="hint">تصویر باید کمتر از ۲ مگابایت باشد.</small>
          {avatarError && <div className="error">{avatarError}</div>}
        </article>

        <section className="profile-card">
          <h2>ظاهر برنامه</h2>
          <p className="hint">حالت پیش‌فرض روشن است. اگر ترجیح می‌دهید، می‌توانید تغییر دهید.</p>
          <div className="theme-choice" role="group" aria-label="انتخاب ظاهر">
            {THEMES.map(t => (
              <button key={t.value} type="button"
                      className={theme === t.value ? 'active' : ''}
                      aria-pressed={theme === t.value}
                      onClick={() => chooseTheme(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <form className="profile-card" onSubmit={submit}>
          <h2>تغییر رمز عبور</h2>
          {forced
            ? <p className="hint">رمز فعلی شما موقت است. کافی است رمز تازه را دو بار وارد کنید.</p>
            : <p className="hint">برای تغییر رمز، ابتدا رمز فعلی خود را وارد کنید.</p>}

          {!forced && (
            <label>رمز فعلی
              <input type="password" autoComplete="current-password" required
                     value={currentPassword} onChange={e => setCurrent(e.target.value)} />
            </label>
          )}

          <label>رمز جدید
            <input type="password" autoComplete="new-password" required
                   minLength={MIN_PASSWORD_LENGTH}
                   aria-describedby="pw-rule"
                   value={newPassword} onChange={e => setNext(e.target.value)} />
          </label>
          {/* Validated inline as they type, not withheld until submit. */}
          <small id="pw-rule" className={tooShort ? 'field-error' : 'hint'}>
            حداقل {fa(MIN_PASSWORD_LENGTH)} نویسه.
          </small>

          <label>تکرار رمز جدید
            <input type="password" autoComplete="new-password" required
                   minLength={MIN_PASSWORD_LENGTH}
                   value={confirm} onChange={e => setConfirm(e.target.value)} />
          </label>
          {mismatch && <small className="field-error">تکرار رمز یکسان نیست.</small>}

          {error && <div className="error">{error}</div>}
          {done && <div className="success" role="status">رمز عبور با موفقیت تغییر کرد.</div>}

          <button className="primary wide" disabled={busy || tooShort || mismatch}>
            {busy ? 'در حال ثبت…' : 'ثبت رمز جدید'}
          </button>
        </form>
      </section>
    </div>
  );
}
