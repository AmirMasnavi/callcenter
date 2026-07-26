import{useMemo,useState}from'react';
import{useMutation,useQuery,useQueryClient}from'@tanstack/react-query';
import{api,fa,faDate,faDateTime,Report,statusLabel}from'../lib/api';
import Loading from'../components/Loading';
type Revision={id:number;actor:string;reason:string;createdAt:string};
export default function SupervisorPage(){
 const qc=useQueryClient(),q=useQuery({queryKey:['team-reports'],queryFn:()=>api<Report[]>('/api/v1/supervisor/reports')});
 const[tab,setTab]=useState<'PENDING'|'DONE'|'ALL'>('PENDING'),[search,setSearch]=useState(''),[selected,setSelected]=useState<Report>(),[edit,setEdit]=useState<Report>(),[reason,setReason]=useState('');
 const revisions=useQuery({queryKey:['revisions',selected?.id],queryFn:()=>api<Revision[]>(`/api/v1/supervisor/reports/${selected!.id}/revisions`),enabled:!!selected});
 const filtered=useMemo(()=>q.data?.filter(r=>(tab==='ALL'||(tab==='PENDING'?r.status==='SUBMITTED':r.status==='APPROVED'||r.status==='CORRECTED_APPROVED'))&&(!search||`${r.agentName} ${r.reportLabel||''}`.includes(search)))||[],[q.data,tab,search]);
 const counts={pending:q.data?.filter(r=>r.status==='SUBMITTED').length||0,done:q.data?.filter(r=>r.status==='APPROVED'||r.status==='CORRECTED_APPROVED').length||0};
 const review=useMutation({mutationFn:()=>api<Report>(`/api/v1/supervisor/reports/${edit!.id}/approve`,{method:'POST',body:JSON.stringify({...edit,correctionReason:reason})}),onSuccess:r=>{setSelected(r);setEdit({...r});setReason('');qc.invalidateQueries({queryKey:['team-reports']});qc.invalidateQueries({queryKey:['revisions',r.id]})}});
 function choose(r:Report){setSelected(r);setEdit({...r});setReason('')}
 const changed=!!selected&&!!edit&&['totalPeople','contactedCount','okCount','maybeCount','noCount','noAnswerCount','notes'].some(k=>selected[k as keyof Report]!==edit[k as keyof Report]);
 const approved=selected?.status==='APPROVED'||selected?.status==='CORRECTED_APPROVED';
 const sum=(edit?.okCount||0)+(edit?.maybeCount||0)+(edit?.noCount||0)+(edit?.noAnswerCount||0);
 const valid=!!edit&&edit.totalPeople>0&&edit.contactedCount<=edit.totalPeople&&sum===edit.contactedCount;
 return <div className="page supervisor"><header className="page-head"><div><span className="eyebrow">پنل ناظر</span><h1>کنترل عملکرد تیم</h1><p>گزارش‌های در انتظار، تأییدشده و اصلاحات تیم در یک جا.</p></div><div className="supervisor-stats"><span><b>{fa(counts.pending)}</b> در انتظار</span><span><b>{fa(counts.done)}</b> تأییدشده</span></div></header>
 <section className="supervisor-toolbar"><div className="segmented"><button className={tab==='PENDING'?'active':''} onClick={()=>setTab('PENDING')}>در انتظار ({fa(counts.pending)})</button><button className={tab==='DONE'?'active':''} onClick={()=>setTab('DONE')}>تأییدشده ({fa(counts.done)})</button><button className={tab==='ALL'?'active':''} onClick={()=>setTab('ALL')}>همه</button></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جست‌وجوی اپراتور یا عنوان…"/></section>
 {q.isLoading?<Loading/>:<div className="review-layout"><section className="queue">{!filtered.length&&<div className="empty compact">گزارشی در این بخش نیست.</div>}{filtered.map(r=><button className={selected?.id===r.id?'active':''} key={r.id} onClick={()=>choose(r)}><div className="avatar">{r.agentName.slice(0,1)}<img src={`/api/v1/users/${r.agentId}/avatar`} onError={e=>e.currentTarget.style.display='none'}/></div><div><b>{r.agentName}</b><small>{r.reportLabel||'بدون عنوان'} · {faDate(r.reportDate)}</small><small>{faDateTime(r.submittedAt||r.createdAt)}</small></div><span className={'status '+r.status}>{statusLabel[r.status]}</span></button>)}</section>
 {edit?<section className="review-card"><div className="review-title"><div><b>{edit.agentName} — {edit.reportLabel||'گزارش بدون عنوان'}</b><span>{faDate(edit.reportDate)} · ارسال: {faDateTime(edit.submittedAt)}</span></div><span className={'status '+edit.status}>{statusLabel[edit.status]}</span></div>
 <div className="review-fields">{([['totalPeople','کل افراد'],['contactedCount','تماس‌گرفته'],['okCount','OK'],['maybeCount','شاید'],['noCount','NO'],['noAnswerCount','جواب نداد']]as const).map(([k,l])=><label key={k}>{l}<input inputMode="numeric" value={edit[k]} onChange={e=>setEdit({...edit,[k]:Math.max(0,Number(e.target.value)||0)})}/></label>)}</div>
 <div className={'review-equation '+(valid?'valid':'invalid')}>جمع نتایج: {fa(sum)} از {fa(edit.contactedCount)} تماس {valid?'✓':'— نیازمند اصلاح'}</div>
 <label className="notes">توضیحات<textarea value={edit.notes||''} onChange={e=>setEdit({...edit,notes:e.target.value})}/></label>
 {(changed||approved)&&<label className="notes required">دلیل {approved?'اصلاح مجدد':'اصلاح'}<textarea required value={reason} onChange={e=>setReason(e.target.value)} placeholder="دلیل تغییر را برای تاریخچه ثبت کنید…"/></label>}
 {review.error&&<div className="error">{review.error.message}</div>}
 <button className="primary wide review-submit" disabled={!valid||(!changed&&approved)||(!!changed&&!reason.trim())||review.isPending} onClick={()=>review.mutate()}>{approved?'ثبت اصلاح مجدد':changed?'اصلاح و تأیید نهایی':'تأیید گزارش'} ✓</button>
 <div className="timeline"><h3>تاریخچه گزارش</h3><div><i/><p><b>ثبت توسط {edit.agentName}</b><span>{faDateTime(edit.createdAt)}</span></p></div>{edit.submittedAt&&<div><i/><p><b>ارسال برای بررسی</b><span>{faDateTime(edit.submittedAt)}</span></p></div>}{revisions.data?.map(x=><div key={x.id}><i/><p><b>اصلاح توسط {x.actor}</b><span>{x.reason} · {faDateTime(x.createdAt)}</span></p></div>)}{edit.reviewedAt&&<div><i/><p><b>تأیید توسط {edit.reviewerName}</b><span>{faDateTime(edit.reviewedAt)}</span></p></div>}</div>
 </section>:<div className="empty compact">یک گزارش را برای مشاهده جزئیات انتخاب کنید.</div>}</div>}</div>
}
