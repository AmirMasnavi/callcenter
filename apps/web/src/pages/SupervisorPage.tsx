import{useMemo,useState}from'react';
import{useMutation,useQuery,useQueryClient}from'@tanstack/react-query';
import{api,apiUrl,fa,faDate,faDateTime,Report,statusLabel}from'../lib/api';
import Loading from'../components/Loading';
import Icon from'../components/Icon';
type Revision={id:number;actor:string;reason:string;createdAt:string};
// Void and reopen are separate capabilities, so they unlock independently. The list
// endpoint already widens to every team server-side, so no separate query is needed here.
export default function SupervisorPage({canVoid=false,canReopen=false,canArchive=false}:{canVoid?:boolean,canReopen?:boolean,canArchive?:boolean}){
 const qc=useQueryClient(),q=useQuery({queryKey:['team-reports'],queryFn:()=>api<Report[]>('/api/v1/supervisor/reports')});
 const[adminAction,setAdminAction]=useState<'void'|'reopen'>(),[adminReason,setAdminReason]=useState('');
 const[tab,setTab]=useState<'PENDING'|'DONE'|'ALL'|'ARCHIVED'>('PENDING'),[picked,setPicked]=useState<number[]>([]),[search,setSearch]=useState(''),[selected,setSelected]=useState<Report>(),[edit,setEdit]=useState<Report>(),[reason,setReason]=useState('');
 const archivedQ=useQuery({queryKey:['archived-reports'],queryFn:()=>api<Report[]>('/api/v1/supervisor/reports/archived'),enabled:tab==='ARCHIVED'});
 const archiveMutation=useMutation({
  mutationFn:(archive:boolean)=>api<{changed:number}>(`/api/v1/supervisor/reports/${archive?'archive':'unarchive'}`,{method:'POST',body:JSON.stringify({reportIds:picked})}),
  onSuccess:()=>{setPicked([]);setSelected(undefined);setEdit(undefined);
   qc.invalidateQueries({queryKey:['team-reports']});qc.invalidateQueries({queryKey:['archived-reports']})}});
 const revisions=useQuery({queryKey:['revisions',selected?.id],queryFn:()=>api<Revision[]>(`/api/v1/supervisor/reports/${selected!.id}/revisions`),enabled:!!selected});
 const filtered=useMemo(()=>{
  const source=tab==='ARCHIVED'?(archivedQ.data||[]):(q.data||[]);
  return source.filter(r=>
   (tab==='ARCHIVED'||tab==='ALL'||(tab==='PENDING'?r.status==='SUBMITTED':r.status==='APPROVED'||r.status==='CORRECTED_APPROVED'))
   &&(!search||`${r.agentName} ${r.reportLabel||''} ${r.school||''}`.includes(search)));
 },[q.data,archivedQ.data,tab,search]);
 const counts={pending:q.data?.filter(r=>r.status==='SUBMITTED').length||0,done:q.data?.filter(r=>r.status==='APPROVED'||r.status==='CORRECTED_APPROVED').length||0};
 const review=useMutation({mutationFn:()=>api<Report>(`/api/v1/supervisor/reports/${edit!.id}/approve`,{method:'POST',body:JSON.stringify({...edit,correctionReason:reason})}),onSuccess:r=>{setSelected(r);setEdit({...r});setReason('');qc.invalidateQueries({queryKey:['team-reports']});qc.invalidateQueries({queryKey:['revisions',r.id]})}});
 const adminMutation=useMutation({
  mutationFn:()=>adminAction==='void'
   ?api<Report>(`/api/v1/admin/reports/${edit!.id}/void`,{method:'POST',body:JSON.stringify({version:edit!.version,reason:adminReason})})
   :api<Report>(`/api/v1/admin/reports/${edit!.id}/reopen`,{method:'POST',body:JSON.stringify({version:edit!.version,target:'SUBMITTED',reason:adminReason})}),
  onSuccess:r=>{setAdminAction(undefined);setAdminReason('');
   // A voided report leaves every list, so drop the selection rather than show a ghost.
   if(r.voided){setSelected(undefined);setEdit(undefined)}else{setSelected(r);setEdit({...r})}
   qc.invalidateQueries({queryKey:['team-reports']});qc.invalidateQueries({queryKey:['revisions',r.id]})}});
 function togglePick(id:number){setPicked(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}
 function choose(r:Report){setSelected(r);setEdit({...r});setReason('');setAdminAction(undefined);setAdminReason('')}
 const changed=!!selected&&!!edit&&['totalPeople','contactedCount','okCount','maybeCount','noCount','noAnswerCount','attendeeCount','school','notes'].some(k=>selected[k as keyof Report]!==edit[k as keyof Report]);
 const approved=selected?.status==='APPROVED'||selected?.status==='CORRECTED_APPROVED';
 const sum=(edit?.okCount||0)+(edit?.maybeCount||0)+(edit?.noCount||0)+(edit?.noAnswerCount||0);
 const valid=!!edit&&edit.totalPeople>0&&edit.contactedCount<=edit.totalPeople&&sum===edit.contactedCount&&(edit.attendeeCount==null||edit.attendeeCount<=edit.totalPeople);
 return <div className="page supervisor"><header className="page-head"><div><span className="eyebrow">پنل ناظر</span><h1>کنترل عملکرد تیم</h1><p>گزارش‌های در انتظار، تأییدشده و اصلاحات تیم در یک جا.</p></div><div className="supervisor-stats"><span><b>{fa(counts.pending)}</b> در انتظار</span><span><b>{fa(counts.done)}</b> تأییدشده</span></div></header>
 <section className="supervisor-toolbar"><div className="segmented"><button className={tab==='PENDING'?'active':''} onClick={()=>{setTab('PENDING');setPicked([])}}>در انتظار ({fa(counts.pending)})</button><button className={tab==='DONE'?'active':''} onClick={()=>{setTab('DONE');setPicked([])}}>تأییدشده ({fa(counts.done)})</button><button className={tab==='ALL'?'active':''} onClick={()=>{setTab('ALL');setPicked([])}}>همه</button>
 {canArchive&&<button className={tab==='ARCHIVED'?'active':''} onClick={()=>{setTab('ARCHIVED');setPicked([]);setSelected(undefined);setEdit(undefined)}}>بایگانی</button>}</div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جست‌وجوی اپراتور یا عنوان…"/></section>
 {q.isLoading?<Loading/>:<div className={'review-layout'+(edit?' detail-open':'')}>{canArchive&&!!filtered.length&&<div className="bulk-bar">
  <label className="toggle">
   <input type="checkbox" checked={picked.length===filtered.length&&picked.length>0}
     onChange={e=>setPicked(e.target.checked?filtered.map(r=>r.id):[])}/>
   {picked.length?`${fa(picked.length)} انتخاب‌شده`:'انتخاب همه'}
  </label>
  {!!picked.length&&<button className={tab==='ARCHIVED'?'secondary':'danger'} disabled={archiveMutation.isPending}
    onClick={()=>archiveMutation.mutate(tab!=='ARCHIVED')}>
    {archiveMutation.isPending?'…':tab==='ARCHIVED'?'بازگردانی':'بایگانی'}
   </button>}
 </div>}
 <section className="queue">{!filtered.length&&<div className="empty compact">گزارشی در این بخش نیست.</div>}{filtered.map(r=><button className={(selected?.id===r.id?'active':'')+(picked.includes(r.id)?' picked':'')} key={r.id} onClick={()=>choose(r)}>
  {canArchive&&<span className="queue-pick" onClick={e=>{e.stopPropagation();togglePick(r.id)}}>
   <input type="checkbox" checked={picked.includes(r.id)} readOnly tabIndex={-1}/>
  </span>}<div className="avatar">{r.agentName.slice(0,1)}<img src={apiUrl(`/api/v1/users/${r.agentId}/avatar`)} onError={e=>e.currentTarget.style.display='none'}/></div><div><b>{r.agentName}</b><small>{r.school||r.reportLabel||'بدون عنوان'} · {faDate(r.reportDate)}</small><small>{faDateTime(r.submittedAt||r.createdAt)}</small></div><span className={'status '+r.status}>{statusLabel[r.status]}</span></button>)}</section>
 {edit?<section className="review-card">
 <button className="back-to-queue" onClick={()=>{setSelected(undefined);setEdit(undefined)}}>
  <Icon name="back" size={18}/><span>بازگشت به فهرست</span>
 </button>
 <div className="review-title"><div><b>{edit.agentName} — {edit.reportLabel||'گزارش بدون عنوان'}</b><span>{faDate(edit.reportDate)} · ارسال: {faDateTime(edit.submittedAt)}</span></div><span className={'status '+edit.status}>{statusLabel[edit.status]}</span></div>
 <div className="review-fields">{([['totalPeople','کل افراد'],['contactedCount','تماس‌گرفته'],['okCount','OK'],['maybeCount','شاید'],['noCount','NO'],['noAnswerCount','جواب نداد']]as const).map(([k,l])=><label key={k}>{l}<input inputMode="numeric" value={edit[k]} onChange={e=>setEdit({...edit,[k]:Math.max(0,Number(e.target.value)||0)})}/></label>)}</div>
 <div className="review-attendance">
  <label>مدرسه<input maxLength={160} value={edit.school||''} onChange={e=>setEdit({...edit,school:e.target.value})} placeholder="نام مدرسه"/></label>
  {/* Blank means "not known yet" and must stay blank rather than become zero. */}
  <label>تعداد حاضرین<input inputMode="numeric" value={edit.attendeeCount??''} placeholder="—"
    onChange={e=>setEdit({...edit,attendeeCount:e.target.value.trim()===''?null:Math.max(0,Number(e.target.value)||0)})}/></label>
  <span className="attendance-summary">{edit.attendeeCount==null?'هنوز ثبت نشده':edit.okCount>0?`نرخ حضور ${fa(Math.round((edit.attendeeCount/edit.okCount)*1000)/10)}٪ از پاسخ‌های مثبت`:'—'}</span>
 </div>
 <div className={'review-equation '+(valid?'valid':'invalid')}>جمع نتایج: {fa(sum)} از {fa(edit.contactedCount)} تماس {valid?'✓':'— نیازمند اصلاح'}</div>
 <label className="notes">توضیحات<textarea value={edit.notes||''} onChange={e=>setEdit({...edit,notes:e.target.value})}/></label>
 {(changed||approved)&&<label className="notes required">دلیل {approved?'اصلاح مجدد':'اصلاح'}<textarea required value={reason} onChange={e=>setReason(e.target.value)} placeholder="دلیل تغییر را برای تاریخچه ثبت کنید…"/></label>}
 {review.error&&<div className="error">{review.error.message}</div>}
 <button className="primary wide review-submit" disabled={!valid||(!changed&&approved)||(!!changed&&!reason.trim())||review.isPending} onClick={()=>review.mutate()}>{approved?'ثبت اصلاح مجدد':changed?'اصلاح و تأیید نهایی':'تأیید گزارش'} ✓</button>
 {(canVoid||canReopen)&&<section className="admin-actions"><h3>اختیارات ویژه</h3>
  {!adminAction
   ?<div className="admin-action-row">
     {canReopen&&approved&&<button className="secondary" onClick={()=>{setAdminAction('reopen');setAdminReason('')}}>بازگشایی برای اصلاح</button>}
     {canVoid&&<button className="danger" onClick={()=>{setAdminAction('void');setAdminReason('')}}>ابطال گزارش</button>}
    </div>
   :<div className="admin-confirm">
     {/* A confirmation step only because voiding is the one hard-to-undo action here. */}
     <p>{adminAction==='void'
      ?'گزارش ابطال می‌شود و از فهرست‌ها حذف می‌گردد. سابقه و تاریخچه باقی می‌ماند و قابل بازگردانی است.'
      :'گزارش به وضعیت «در انتظار تأیید» بازمی‌گردد و تأیید قبلی پاک می‌شود.'}</p>
     <label className="notes required">دلیل
      <textarea required value={adminReason} onChange={e=>setAdminReason(e.target.value)} placeholder="دلیل را برای تاریخچه ثبت کنید…"/>
     </label>
     {adminMutation.error&&<div className="error">{adminMutation.error.message}</div>}
     <div className="admin-action-row">
      <button className={adminAction==='void'?'danger':'primary'} disabled={!adminReason.trim()||adminMutation.isPending} onClick={()=>adminMutation.mutate()}>
       {adminMutation.isPending?'در حال ثبت…':adminAction==='void'?'تأیید ابطال':'تأیید بازگشایی'}
      </button>
      <button className="secondary" onClick={()=>setAdminAction(undefined)}>انصراف</button>
     </div>
    </div>}
 </section>}
 <div className="timeline"><h3>تاریخچه گزارش</h3><div><i/><p><b>ثبت توسط {edit.agentName}</b><span>{faDateTime(edit.createdAt)}</span></p></div>{edit.submittedAt&&<div><i/><p><b>ارسال برای بررسی</b><span>{faDateTime(edit.submittedAt)}</span></p></div>}{revisions.data?.map(x=><div key={x.id}><i/><p><b>اصلاح توسط {x.actor}</b><span>{x.reason} · {faDateTime(x.createdAt)}</span></p></div>)}{edit.reviewedAt&&<div><i/><p><b>تأیید توسط {edit.reviewerName}</b><span>{faDateTime(edit.reviewedAt)}</span></p></div>}</div>
 </section>:<div className="empty compact">یک گزارش را برای مشاهده جزئیات انتخاب کنید.</div>}</div>}</div>
}
