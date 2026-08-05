import { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUrl, can, Me, Permission, primaryRole, roleLabel } from './lib/api';
import Login from './pages/Login';
import Loading from './components/Loading';
import Icon, { IconName } from './components/Icon';
import MoreSheet from './components/MoreSheet';

const AgentPage = lazy(() => import('./pages/AgentPage'));
const SupervisorPage = lazy(() => import('./pages/SupervisorPage'));
const ManagerPage = lazy(() => import('./pages/ManagerPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const SchoolsPage = lazy(() => import('./pages/SchoolsPage'));
const SecurityPage = lazy(() => import('./pages/SecurityPage'));

interface NavItem { path: string; icon: IconName; label: string; needs?: Permission[] }

/*
 * Nav is driven by what the user may DO, not by which role they hold. An operator granted
 * EXPORT_DATA sees the dashboard without being promoted to manager. Labels name their
 * contents ("بررسی گزارش‌ها"), never a vague umbrella.
 */
const NAV: NavItem[] = [
  { path: '/app/report',    icon: 'plus',    label: 'ثبت گزارش',     needs: ['SUBMIT_REPORTS'] },
  { path: '/app/history',   icon: 'history', label: 'گزارش‌های من',   needs: ['SUBMIT_REPORTS'] },
  { path: '/app/review',    icon: 'check',   label: 'بررسی گزارش‌ها', needs: ['REVIEW_REPORTS'] },
  { path: '/app/dashboard', icon: 'chart',   label: 'داشبورد',       needs: ['VIEW_DASHBOARD'] },
  { path: '/app/admin',     icon: 'users',   label: 'کاربران',        needs: ['MANAGE_USERS'] },
  { path: '/app/schools',   icon: 'school',  label: 'مدارس',          needs: ['MANAGE_SCHOOLS'] },
  { path: '/app/security',  icon: 'key',     label: 'امنیت',          needs: ['MANAGE_SETTINGS'] },
  { path: '/app/profile',   icon: 'user',    label: 'حساب من' },
];

const navFor = (me: Me) =>
  NAV.filter(item => !item.needs || item.needs.some(p => me.permissions?.includes(p)));

/* The bottom bar shows at most four destinations — the ones used every day — and a
   "More" button for the rest. Seven items truncated every label at 375px and put admin
   screens beside the one task an operator repeats all day. */
const PRIMARY_ORDER = ['/app/report', '/app/review', '/app/dashboard', '/app/history', '/app/admin', '/app/profile'];
const primaryNav = (items: NavItem[]) =>
  [...items].sort((a, b) => PRIMARY_ORDER.indexOf(a.path) - PRIMARY_ORDER.indexOf(b.path)).slice(0, 4);

export default function App() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/api/v1/auth/me'), retry: false });
  const user = me.data as Me | null | undefined;
  const [path, setPath] = useState(location.pathname);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

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

  const nav = user ? navFor(user) : [];
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
    navigate(navFor(m)[0]?.path ?? '/app/profile', true);
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
              <Icon name={n.icon} /><span>{n.label}</span>
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
          <button className="logout-btn" onClick={logout} title="خروج از حساب">
            <Icon name="logout" label="خروج از حساب" />
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
            : active === '/app/review' ? <SupervisorPage canVoid={can(user, 'VOID_REPORT')} canReopen={can(user, 'REOPEN_REPORT')} />
            : active === '/app/dashboard' ? <ManagerPage />
            : active === '/app/schools' ? <SchoolsPage />
            : active === '/app/security' ? <SecurityPage />
            : active === '/app/profile' ? <ProfilePage me={user} onLogout={logout} />
            : <AdminPage />}
        </Suspense>
      </main>

      <div className="content-edge" aria-hidden="true" />

      <nav className="bottom-nav">
        {primaryNav(nav).map(n => (
          <button key={n.path} className={active === n.path ? 'active' : ''}
                  aria-current={active === n.path ? 'page' : undefined}
                  ref={n.path === active ? (el => el?.scrollIntoView({ block: 'nearest', inline: 'center' })) : undefined}
                  onClick={() => navigate(n.path)}>
            <Icon name={n.icon} /><span>{n.label}</span>
          </button>
        ))}
        <button className={moreOpen ? 'active' : ''} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
          <Icon name="menu" /><span>بیشتر</span>
        </button>
      </nav>

      {moreOpen && (
        <MoreSheet me={user} onClose={() => setMoreOpen(false)} onLogout={logout}
                   onNavigate={navigate} hidePaths={primaryNav(nav).map(n => n.path)} />
      )}
    </div>
  );
}
