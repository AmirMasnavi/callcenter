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

  function chooseTheme(choice: ThemeChoice) {
    setTheme(choice);
    setThemeChoice(choice);
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
            <img src={apiUrl(`/api/v1/users/${me.id}/avatar`)} alt=""
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
