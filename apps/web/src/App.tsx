import { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUrl, hasRole, Me, primaryRole, Role, roleLabel } from './lib/api';
import Login from './pages/Login';
import Loading from './components/Loading';

const AgentPage = lazy(() => import('./pages/AgentPage'));
const SupervisorPage = lazy(() => import('./pages/SupervisorPage'));
const ManagerPage = lazy(() => import('./pages/ManagerPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ProfilePage = lazy(() => import('./pages/Profile'));

interface NavItem { path: string; icon: string; label: string; roles: Role[] }

/*
 * Nav is derived from the union of the user's roles, not a single one — that is the
 * whole point of the multi-role model. Labels name their contents ("بررسی گزارش‌ها"),
 * never a vague umbrella, so the destination is predictable before you arrive.
 */
const NAV: NavItem[] = [
  { path: '/app/report',    icon: '＋', label: 'ثبت گزارش',     roles: ['AGENT'] },
  { path: '/app/history',   icon: '◷', label: 'گزارش‌های من',   roles: ['AGENT'] },
  { path: '/app/review',    icon: '✓', label: 'بررسی گزارش‌ها', roles: ['SUPERVISOR', 'MANAGER', 'ADMIN'] },
  { path: '/app/dashboard', icon: '▦', label: 'داشبورد',       roles: ['MANAGER', 'ADMIN'] },
  { path: '/app/admin',     icon: '♟', label: 'کاربران',        roles: ['ADMIN'] },
  { path: '/app/profile',   icon: '☺', label: 'حساب من',        roles: ['AGENT', 'SUPERVISOR', 'MANAGER', 'ADMIN'] },
];

const navFor = (roles: Role[]) => NAV.filter(item => item.roles.some(r => roles.includes(r)));

export default function App() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/api/v1/auth/me'), retry: false });
  const user = me.data as Me | null | undefined;
  const [path, setPath] = useState(location.pathname);
  const [promptDismissed, setPromptDismissed] = useState(false);

  function navigate(next: string, replace = false) {
    history[replace ? 'replaceState' : 'pushState']({}, '', next);
    setPath(next);
  }

  useEffect(() => {
    const pop = () => setPath(location.pathname);
    const expired = () => { qc.setQueryData(['me'], null); navigate('/login', true); };
    addEventListener('popstate', pop);
    addEventListener('auth:expired', expired);
    return () => { removeEventListener('popstate', pop); removeEventListener('auth:expired', expired); };
  }, [qc]);

  const nav = user ? navFor(user.roles) : [];
  const home = nav[0]?.path ?? '/app/profile';

  useEffect(() => {
    if (me.isLoading) return;
    if (!user && path !== '/login') navigate('/login', true);
    // No blocking wall any more: a temporary password is surfaced as a prompt inside
    // the app, so people can get to work and change it when they choose.
    else if (user && !path.startsWith('/app/')) navigate(home, true);
  }, [me.isLoading, user?.id, path]);

  async function logout() {
    try { await api('/api/v1/auth/logout', { method: 'POST' }); }
    finally {
      qc.setQueryData(['me'], null);
      qc.removeQueries({ predicate: q => q.queryKey[0] !== 'me' });
      navigate('/login', true);
    }
  }

  async function stopImpersonating() {
    const restored = await api<Me>('/api/v1/auth/stop-impersonating', { method: 'POST' });
    qc.setQueryData(['me'], restored);
    qc.removeQueries({ predicate: q => q.queryKey[0] !== 'me' });
    navigate('/app/admin', true);
  }

  function loggedIn(m: Me) {
    qc.setQueryData(['me'], m);
    setPromptDismissed(false);
    navigate(navFor(m.roles)[0]?.path ?? '/app/profile', true);
  }

  if (me.isLoading) return <Loading />;
  if (!user) return <Login onLogin={loggedIn} />;

  const active = nav.some(n => n.path === path) ? path : home;
  const badge = roleLabel[primaryRole(user.roles)];
  const showPasswordPrompt = user.mustChangePassword && !promptDismissed && active !== '/app/profile';

  return (
    <div className="app-shell">
      {user.impersonatedBy != null && (
        <div className="impersonation-bar" role="status">
          <span>شما در حال مشاهده سامانه به‌جای «{user.displayName}» هستید.</span>
          <button onClick={stopImpersonating}>بازگشت به حساب خودم</button>
        </div>
      )}

      <aside>
        <div className="brand">
          <img src="/brand-logo.png" alt="" className="brand-logo" />
          <div><b>گزارش‌یار</b><span>علم و صنعت آریا</span></div>
        </div>
        <nav>
          {nav.map(n => (
            <button key={n.path} className={active === n.path ? 'active' : ''}
                    aria-current={active === n.path ? 'page' : undefined}
                    onClick={() => navigate(n.path)}>
              <i aria-hidden="true">{n.icon}</i>{n.label}
            </button>
          ))}
        </nav>
        <div className="aside-user">
          <div className="avatar">
            {user.displayName.slice(0, 1)}
            <img src={apiUrl(`/api/v1/users/${user.id}/avatar`)} alt=""
                 onError={e => (e.currentTarget.style.display = 'none')} />
          </div>
          <div><b>{user.displayName}</b><span>{badge}</span></div>
          <button className="logout-btn" onClick={logout} title="خروج">
            <i aria-hidden="true">↪</i><span>خروج</span>
          </button>
        </div>
      </aside>

      <main className="content">
        {showPasswordPrompt && (
          <div className="banner warn" role="status">
            <p>
              <strong>رمز عبور شما موقت است</strong>
              برای امنیت حساب، یک رمز شخصی انتخاب کنید.
            </p>
            <button className="primary" onClick={() => navigate('/app/profile')}>تغییر رمز</button>
            <button className="secondary" onClick={() => setPromptDismissed(true)}>بعداً</button>
          </div>
        )}
        <Suspense fallback={<Loading />}>
          {active === '/app/report' ? <AgentPage view="form" />
            : active === '/app/history' ? <AgentPage view="history" />
            : active === '/app/review' ? <SupervisorPage isAdmin={hasRole(user, 'ADMIN')} />
            : active === '/app/dashboard' ? <ManagerPage />
            : active === '/app/profile' ? <ProfilePage me={user} />
            : <AdminPage />}
        </Suspense>
      </main>

      <nav className="bottom-nav">
        {nav.map(n => (
          <button key={n.path} className={active === n.path ? 'active' : ''}
                  aria-current={active === n.path ? 'page' : undefined}
                  onClick={() => navigate(n.path)}>
            <i aria-hidden="true">{n.icon}</i><span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
