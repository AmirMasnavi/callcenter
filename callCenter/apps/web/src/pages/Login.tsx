import{FormEvent,useState}from'react';import{api,Me}from'../lib/api';
export default function Login({onLogin}:{onLogin:(m:Me)=>void}){
 const[username,setUsername]=useState(()=>localStorage.getItem('lastUsername')||'');const[password,setPassword]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{onLogin(await api<Me>('/api/v1/auth/login',{method:'POST',body:JSON.stringify({username,password})}))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <main className="login-page"><section className="login-art"><div className="brand-mark">آ</div><p>علم و صنعت آریا</p><h1>هر تماس، یک قدم<br/>نزدیک‌تر به موفقیت</h1><span>گزارش‌های روزانه دقیق، تصمیم‌های سریع‌تر</span></section>
 <section className="login-panel"><form className="login-card" onSubmit={submit}><div className="mobile-brand"><div className="brand-mark">آ</div><b>گزارش‌یار آریا</b></div><small>خوش آمدید</small><h2>ورود به سامانه</h2><p>برای ادامه، اطلاعات حساب سازمانی خود را وارد کنید.</p>
 <label>نام کاربری<input autoFocus value={username} onChange={e=>{setUsername(e.target.value);localStorage.setItem('lastUsername',e.target.value)}} autoComplete="username" required placeholder="نام کاربری"/></label>
 <label>رمز عبور<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required placeholder="••••••••••"/></label>
 {error&&<div className="error">{error}</div>}<button className="primary wide" disabled={busy}>{busy?'در حال ورود…':'ورود به سامانه'}</button><footer>نسخه ۱.۰ · پشتیبانی واحد فناوری</footer></form></section></main>
}
