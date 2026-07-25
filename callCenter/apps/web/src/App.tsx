import{lazy,Suspense,useEffect,useState}from'react';
import{useQuery,useQueryClient}from'@tanstack/react-query';
import{api,Me}from'./lib/api';
import Login from'./pages/Login';
import ChangePassword from'./pages/ChangePassword';
import Loading from'./components/Loading';

const AgentPage=lazy(()=>import('./pages/AgentPage'));
const SupervisorPage=lazy(()=>import('./pages/SupervisorPage'));
const ManagerPage=lazy(()=>import('./pages/ManagerPage'));
const AdminPage=lazy(()=>import('./pages/AdminPage'));
const roleHome={AGENT:'/app/report',SUPERVISOR:'/app/review',MANAGER:'/app/dashboard',ADMIN:'/app/admin'} as const;

export default function App(){
 const qc=useQueryClient();
 const me=useQuery({queryKey:['me'],queryFn:()=>api<Me>('/api/v1/auth/me'),retry:false});
 const user=me.data as Me|null|undefined;
 const[path,setPath]=useState(location.pathname);
 function navigate(next:string,replace=false){history[replace?'replaceState':'pushState']({},'',next);setPath(next)}
 useEffect(()=>{const pop=()=>setPath(location.pathname);const expired=()=>{qc.setQueryData(['me'],null);navigate('/login',true)};addEventListener('popstate',pop);addEventListener('auth:expired',expired);return()=>{removeEventListener('popstate',pop);removeEventListener('auth:expired',expired)}},[qc]);
 useEffect(()=>{if(me.isLoading)return;if(!user&&path!=='/login')navigate('/login',true);else if(user?.mustChangePassword&&path!=='/change-password')navigate('/change-password',true);else if(user&&!user.mustChangePassword&&!path.startsWith('/app/'))navigate(roleHome[user.role],true)},[me.isLoading,user?.id,user?.mustChangePassword,path]);
 async function logout(){try{await api('/api/v1/auth/logout',{method:'POST'})}finally{qc.setQueryData(['me'],null);qc.removeQueries({predicate:q=>q.queryKey[0]!=='me'});navigate('/login',true)}}
 function loggedIn(m:Me){qc.setQueryData(['me'],m);navigate(m.mustChangePassword?'/change-password':roleHome[m.role],true)}
 if(me.isLoading)return <Loading/>;
 if(!user)return <Login onLogin={loggedIn}/>;
 if(user.mustChangePassword)return <ChangePassword done={()=>{qc.setQueryData(['me'],{...user,mustChangePassword:false});navigate(roleHome[user.role],true)}} onLogout={logout}/>;

 const nav=user.role==='AGENT'?[['/app/report','＋','ثبت گزارش'],['/app/history','◷','گزارش‌ها']]:user.role==='SUPERVISOR'?[['/app/review','✓','بررسی گزارش‌ها']]:user.role==='MANAGER'?[['/app/dashboard','▦','داشبورد']]:[['/app/admin','♙','کاربران']];
 const allowed=nav.map(x=>x[0]);const active=allowed.includes(path)?path:roleHome[user.role];
 return <div className="app-shell"><aside><div className="brand"><div className="brand-mark">آ</div><div><b>گزارش‌یار</b><span>علم و صنعت آریا</span></div></div><nav>{nav.map(n=><button key={n[0]} className={active===n[0]?'active':''} onClick={()=>navigate(n[0])}><i>{n[1]}</i>{n[2]}</button>)}</nav><div className="aside-user"><div className="avatar">{user.displayName.slice(0,1)}<img src={`/api/v1/users/${user.id}/avatar`} onError={e=>e.currentTarget.style.display='none'}/></div><div><b>{user.displayName}</b><span>{{AGENT:'اپراتور',SUPERVISOR:'ناظر',MANAGER:'مدیر',ADMIN:'ادمین'}[user.role]}</span></div><button className="logout-btn" onClick={logout} title="خروج"><i>↪</i><span>خروج</span></button></div></aside>
 <main className="content"><Suspense fallback={<Loading/>}>{active==='/app/report'?<AgentPage view="form"/>:active==='/app/history'?<AgentPage view="history"/>:active==='/app/review'?<SupervisorPage/>:active==='/app/dashboard'?<ManagerPage/>:<AdminPage/>}</Suspense></main>
 <nav className="bottom-nav">{nav.map(n=><button key={n[0]} className={active===n[0]?'active':''} onClick={()=>navigate(n[0])}><i>{n[1]}</i><span>{n[2]}</span></button>)}<button onClick={logout}><i>↪</i><span>خروج</span></button></nav></div>
}
