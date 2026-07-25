import{useEffect,useState}from'react';
import{useMutation,useQuery,useQueryClient}from'@tanstack/react-query';
import{api,fa,faDate,Report,statusLabel}from'../lib/api';
import JalaliDate,{todayIso}from'../components/JalaliDate';
import Loading from'../components/Loading';

type Form={totalPeople:number;contactedCount:number;okCount:number;maybeCount:number;noCount:number;noAnswerCount:number;notes:string};
const empty:Form={totalPeople:0,contactedCount:0,okCount:0,maybeCount:0,noCount:0,noAnswerCount:0,notes:''};
const localKey=(date:string)=>`agent-draft:${date}`;

export default function AgentPage({view}:{view:'form'|'history'}){
 const qc=useQueryClient();
 const q=useQuery({queryKey:['mine'],queryFn:()=>api<Report[]>('/api/v1/reports/mine')});
 const[date,setDate]=useState(todayIso());
 const[form,setForm]=useState<Form>(empty);
 const[version,setVersion]=useState<number>();
 const[id,setId]=useState<number>();
 const[notice,setNotice]=useState('');

 useEffect(()=>{if(!q.isSuccess)return;const r=q.data.find(x=>x.reportDate===date);if(r){setId(r.id);setVersion(r.version);setForm({totalPeople:r.totalPeople,contactedCount:r.contactedCount,okCount:r.okCount,maybeCount:r.maybeCount,noCount:r.noCount,noAnswerCount:r.noAnswerCount,notes:r.notes||''})}else{setId(undefined);setVersion(undefined);try{setForm(JSON.parse(sessionStorage.getItem(localKey(date))||'null')||empty)}catch{setForm(empty)}}},[date,q.isSuccess]);
 function update(next:Form){setForm(next);sessionStorage.setItem(localKey(date),JSON.stringify(next))}
 function changeDate(next:string){if(next&&next!==date){sessionStorage.setItem(localKey(date),JSON.stringify(form));setDate(next);setNotice('')}}
 function number(key:Exclude<keyof Form,'notes'>,value:string){const normalized=value.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));update({...form,[key]:Math.max(0,Number(normalized)||0)})}
 const outcomes=form.okCount+form.maybeCount+form.noCount+form.noAnswerCount;
 const notContacted=form.totalPeople-form.contactedCount;
 const errors:string[]=[];
 if(form.totalPeople<=0)errors.push('کل افراد باید بیشتر از صفر باشد.');
 if(form.contactedCount>form.totalPeople)errors.push('تعداد تماس‌گرفته نمی‌تواند از کل افراد بیشتر باشد.');
 if(outcomes!==form.contactedCount)errors.push(`جمع چهار نتیجه باید دقیقاً برابر ${fa(form.contactedCount)} تماس باشد؛ اکنون ${fa(outcomes)} است.`);
 const valid=errors.length===0;
 const current=q.data?.find(x=>x.reportDate===date),locked=!!current&&current.status!=='DRAFT';
 const save=useMutation({mutationFn:()=>api<Report>('/api/v1/reports/draft',{method:'POST',body:JSON.stringify({...form,reportDate:date,version})}),onSuccess:r=>{setId(r.id);setVersion(r.version);sessionStorage.removeItem(localKey(date));setNotice('پیش‌نویس ذخیره شد.');qc.invalidateQueries({queryKey:['mine']})}});
 const submit=useMutation({mutationFn:async()=>{const saved=await api<Report>('/api/v1/reports/draft',{method:'POST',body:JSON.stringify({...form,reportDate:date,version})});return api<Report>(`/api/v1/reports/${saved.id}/submit?version=${saved.version}`,{method:'POST'})},onSuccess:()=>{sessionStorage.removeItem(localKey(date));setNotice('گزارش با موفقیت برای ناظر ارسال شد.');qc.invalidateQueries({queryKey:['mine']})}});
 const historyPanel=<section className="history standalone"><div className="section-title"><b>گزارش‌های شما</b><span>برای مشاهده هر گزارش روی آن بزنید</span></div>{q.isLoading?<Loading/>:!q.data?.length?<div className="empty">هنوز گزارشی ثبت نشده است.</div>:<div className="report-list">{q.data.map(r=><button key={r.id} onClick={()=>{changeDate(r.reportDate);window.history.pushState({},'','/app/report');dispatchEvent(new PopStateEvent('popstate'))}}><span className={'status '+r.status}>{statusLabel[r.status]}</span><b>{faDate(r.reportDate)}</b><small>{fa(r.contactedCount)} تماس از {fa(r.totalPeople)} نفر</small><em>{fa(r.okCount)} OK</em></button>)}</div>}</section>;
 if(view==='history')return <div className="page"><header className="page-head"><div><span className="eyebrow">سوابق من</span><h1>گزارش‌های ثبت‌شده</h1><p>پیش‌نویس‌ها و وضعیت بررسی گزارش‌ها.</p></div></header>{historyPanel}</div>;
 return <div className="page"><header className="page-head"><div><span className="eyebrow">گزارش روزانه</span><h1>ثبت عملکرد تماس‌ها</h1><p>آمار هر تاریخ مستقل نگهداری می‌شود و با تغییر تاریخ از بین نمی‌رود.</p></div><div className="date-box"><span>تاریخ گزارش</span><JalaliDate value={date} onChange={changeDate}/></div></header>
 {notice&&<div className="success">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
 <section className="form-card"><div className="section-title"><b>آمار کلی</b><span>{faDate(date)}</span></div>
 <div className="number-grid">{([['totalPeople','کل افراد','نفر'],['contactedCount','تماس‌گرفته','تماس'],['okCount','نتیجه OK','موفق'],['maybeCount','شاید','پیگیری'],['noCount','نتیجه NO','ناموفق'],['noAnswerCount','جواب نداد','تماس']]as const).map(([k,l,s])=><label className={'metric-input '+k} key={k}><span>{l}</span><input aria-label={l} inputMode="numeric" disabled={locked} value={form[k]} onChange={e=>number(k,e.target.value)}/><small>{s}</small></label>)}</div>
 <div className={'equation '+(valid?'valid':'invalid')}><div><span>جمع نتایج</span><b>{fa(outcomes)}</b></div><span>{valid?'✓ اعداد آماده ثبت هستند':'اعداد نیاز به اصلاح دارند'}</span><div><span>تماس‌نگرفته</span><b>{fa(Math.max(0,notContacted))}</b></div></div>
 {!valid&&<div className="validation-list">{errors.map(e=><div key={e}>• {e}</div>)}</div>}
 <label className="notes">توضیحات اختیاری<textarea disabled={locked} maxLength={1000} value={form.notes} onChange={e=>update({...form,notes:e.target.value})} placeholder="اگر نکته‌ای درباره تماس‌های این روز وجود دارد بنویسید…"/></label>
 {!locked?<div className="actions"><button className="secondary" onClick={()=>save.mutate()} disabled={save.isPending||submit.isPending}>ذخیره پیش‌نویس</button><button className="primary" disabled={!valid||save.isPending||submit.isPending} onClick={()=>submit.mutate()}>{submit.isPending?'در حال ارسال…':'ثبت و ارسال برای بررسی ←'}</button></div>:<div className="locked">این گزارش {statusLabel[current.status]} است و دیگر قابل ویرایش نیست.</div>}
 {(save.error||submit.error)&&<div className="error">{(save.error||submit.error)?.message}</div>}</section></div>
}
